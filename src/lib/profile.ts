import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { COL } from "@/lib/collections";
import type { Profile, ProfileInsert, ProfileUpdate } from "@/types/database";
import { sortLocale } from "@/lib/intl";

/**
 * Lấy profile của user hiện tại (theo session).
 * Profile được tạo tự động khi chưa có.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = auth.currentUser;
  if (!user) return null;

  const docRef = doc(db, COL.PROFILES, user.uid);
  try {
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      const newProfile: ProfileInsert = {
        id: user.uid,
        role: "student",
        locale: "vi",
      };
      
      const profileData = {
        ...newProfile,
        full_name: user.displayName || null,
        avatar_url: user.photoURL || null,
        phone: user.phoneNumber || null,
        email: user.email || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await setDoc(docRef, profileData);
      return profileData as Profile;
    }

    const data = docSnap.data() as Profile;
    const updates: Partial<Profile> = {};
    // Backfill email cho profile cũ chưa có (để Admin hiển thị)
    if ((data.email == null || data.email === "") && user.email) {
      updates.email = user.email;
    }
    // Backfill full_name từ Auth displayName (ví dụ đăng ký xong profile đã tạo trước khi set displayName)
    if ((data.full_name == null || data.full_name === "") && user.displayName) {
      updates.full_name = user.displayName;
    }
    if (Object.keys(updates).length > 0) {
      const updated = new Date().toISOString();
      await updateDoc(docRef, { ...updates, updated_at: updated });
      return { ...data, ...updates, updated_at: updated };
    }
    return data;
  } catch (err) {
    console.warn("Could not read/write from Firestore. Returning fallback profile.", err);
    return {
      id: user.uid,
      role: "student",
      full_name: user.displayName || null,
      avatar_url: user.photoURL || null,
      phone: user.phoneNumber || null,
      email: user.email || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Profile;
  }
}

/**
 * Lấy profile theo user id (dùng khi có quyền xem user khác, ví dụ admin).
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const docRef = doc(db, COL.PROFILES, userId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }
  return docSnap.data() as Profile;
}

/**
 * Tạo/cập nhật profile ngay sau khi user mới đăng ký (tránh race với AuthSync).
 * Dùng setDoc(merge: true) để có full_name ngay cả khi doc chưa tồn tại hoặc vừa được tạo với full_name null.
 */
export async function setNewUserProfile(data: {
  full_name?: string | null;
  email?: string | null;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Chưa đăng nhập");
  const docRef = doc(db, COL.PROFILES, user.uid);
  const now = new Date().toISOString();
  await setDoc(
    docRef,
    {
      id: user.uid,
      role: "student",
      locale: "vi",
      full_name: data.full_name ?? user.displayName ?? null,
      email: data.email ?? user.email ?? null,
      avatar_url: user.photoURL ?? null,
      phone: user.phoneNumber ?? null,
      created_at: now,
      updated_at: now,
    },
    { merge: true }
  );
}

/**
 * Cập nhật profile của user hiện tại.
 * Đọc doc hiện tại trước khi update để có thể merge và trả về kết quả
 * mà không cần getDoc thêm lần nữa sau write.
 */
export async function updateCurrentProfile(
  updates: ProfileUpdate,
): Promise<Profile> {
  const user = auth.currentUser;
  if (!user) throw new Error("Chưa đăng nhập");

  const docRef = doc(db, COL.PROFILES, user.uid);
  const currentSnap = await getDoc(docRef);
  const current = (currentSnap.data() as Profile | undefined) ?? ({} as Profile);

  const safeUpdates: ProfileUpdate = {
    full_name: updates.full_name,
    avatar_url: updates.avatar_url,
    phone: updates.phone,
    email: updates.email,
    locale: updates.locale,
    instructor_headline: updates.instructor_headline,
    instructor_bio: updates.instructor_bio,
    instructor_organization: updates.instructor_organization,
    instructor_website: updates.instructor_website,
  };
  const payload = {
    ...Object.fromEntries(
      Object.entries(safeUpdates).filter(([, value]) => value !== undefined),
    ),
    updated_at: new Date().toISOString(),
  };

  await updateDoc(docRef, payload);

  // Trả về kết quả bằng cách merge client-side — không cần đọc lại Firestore.
  return { ...current, ...payload } as Profile;
}

/**
 * Liên kết (hoặc huỷ liên kết) OCID với profile hiện tại.
 * Lưu vào profiles/{uid}.
 */
export async function updateOCIDProfile(input: {
  ocid: string | null;
  ocid_eth_address: string | null;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Chưa đăng nhập");

  const docRef = doc(db, COL.PROFILES, user.uid);
  const now = new Date().toISOString();
  const willConnect = Boolean(input.ocid);

  await updateDoc(docRef, {
    ocid: input.ocid,
    ocid_eth_address: input.ocid_eth_address,
    ocid_connected_at: willConnect ? now : null,
    updated_at: now,
  });
}

/**
 * [ADMIN] Lấy tất cả profiles.
 * Bảo mật được đảm bảo bởi Firestore Rules và RequireRole ở React Router.
 */
export async function getAllProfiles(): Promise<Profile[]> {
  const q = query(collection(db, COL.PROFILES), orderBy("created_at", "desc"));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map((docSnap) => docSnap.data() as Profile);
}

export async function listCoreliaInstructorProfiles(): Promise<Profile[]> {
  const q = query(
    collection(db, COL.PROFILES),
    where("role", "==", "instructor"),
    where("instructor_origin", "==", "corelia"),
  );
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs
    .map((docSnap) => docSnap.data() as Profile)
    .sort((a, b) => {
      const nameA = (a.full_name ?? a.email ?? a.id).toLowerCase();
      const nameB = (b.full_name ?? b.email ?? b.id).toLowerCase();
      return nameA.localeCompare(nameB, sortLocale());
    });
}

/**
 * Upload ảnh đại diện lên Firebase Storage và trả về URL công khai.
 * Đường dẫn: avatars/{userId}/{timestamp}.{ext}
 * Cần Firestore Storage rules cho phép user ghi vào avatars/{userId}/*
 */
export async function uploadAvatar(file: File): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Chưa đăng nhập");

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
  const path = `avatars/${user.uid}/${Date.now()}.${safeExt}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type || `image/${safeExt}`,
    customMetadata: { uploadedBy: user.uid },
  });

  const downloadUrl = await getDownloadURL(storageRef);
  return downloadUrl;
}

/**
 * [ADMIN] Cập nhật role cho một user (hoặc các field khác).
 * Bảo mật được đảm bảo bởi Firestore Rules và RequireRole ở React Router.
 */
export async function updateProfileAdmin(
  userId: string,
  updates: ProfileUpdate,
): Promise<void> {
  const docRef = doc(db, COL.PROFILES, userId);
  const timestampUpdates = {
    ...updates,
    updated_at: new Date().toISOString(),
  };
  
  await updateDoc(docRef, timestampUpdates);
}
