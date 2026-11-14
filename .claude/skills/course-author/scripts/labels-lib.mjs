// .claude/skills/course-author/scripts/labels-lib.mjs
// Module dùng chung tính toán nhãn Part/Bài, phát hiện tham chiếu đến bài kẹt và cập nhật nhãn hiển thị.

export function computeLabels(curriculum, options = {}) {
  const filterLessonId = options.filterLessonId || (() => true);
  const omitEmptyModules = Boolean(options.omitEmptyModules);
  const modules = curriculum?.modules ?? [];
  const labels = {
    lessons: {},
    modules: {},
  };

  let activePartIdx = 0;
  for (let modIdx = 0; modIdx < modules.length; modIdx++) {
    const mod = modules[modIdx];
    const rawLessons = mod.lessons ?? [];
    const visibleLessons = rawLessons.filter((l) => l.lesson_id && filterLessonId(l.lesson_id));

    if (omitEmptyModules && visibleLessons.length === 0) {
      continue;
    }

    const partLetter = String.fromCharCode(65 + activePartIdx); // A, B, C...
    const partLabel = `Part ${partLetter}`;
    if (mod.module_id) {
      labels.modules[mod.module_id] = partLabel;
    }

    visibleLessons.forEach((les, lesIdx) => {
      const lessonNum = lesIdx + 1;
      const lessonLabel = `${partLabel}, Bài ${lessonNum}`;
      labels.lessons[les.lesson_id] = lessonLabel;
    });

    activePartIdx++;
  }

  return labels;
}

export function extractVisibleText(lessonRec) {
  if (!lessonRec || typeof lessonRec !== "object") return "";
  const parts = [];

  const walk = (val) => {
    if (typeof val === "string") {
      parts.push(val);
    } else if (Array.isArray(val)) {
      val.forEach(walk);
    } else if (val && typeof val === "object") {
      Object.values(val).forEach(walk);
    }
  };

  walk(lessonRec);
  return parts.join("\n");
}

export function referencesLesson(text, partLetter, lessonNum) {
  if (!text || typeof text !== "string") return false;

  // Dạng đơn: Part B, Bài 2
  const singleRegex = new RegExp(`\\bPart\\s+${partLetter}\\s*,\\s*Bài\\s+${lessonNum}\\b`, "i");
  if (singleRegex.test(text)) return true;

  // Dạng gộp: Part B (Bài 1, Bài 2) hoặc Part B (Bài 1, 2)
  const groupRegex = new RegExp(`\\bPart\\s+${partLetter}\\s*\\([^)]*\\b(?:Bài\\s+)?${lessonNum}\\b[^)]*\\)`, "i");
  if (groupRegex.test(text)) return true;

  return false;
}

export function resolveCascadingStuckLessons(curriculum, initialStuckSet, rawLessonsMap) {
  const originalLabels = computeLabels(curriculum);
  const stuckSet = new Set(initialStuckSet);

  // Tạo metadata cho từng bài từ nhãn gốc
  const lessonInfoMap = new Map();
  for (const mod of curriculum.modules ?? []) {
    const rawLessons = mod.lessons ?? [];
    rawLessons.forEach((l, idx) => {
      const fullLabel = originalLabels.lessons[l.lesson_id];
      if (fullLabel) {
        const match = fullLabel.match(/^Part\s+([A-Z]),\s*Bài\s+(\d+)$/);
        if (match) {
          lessonInfoMap.set(l.lesson_id, {
            partLetter: match[1],
            lessonNum: parseInt(match[2], 10),
            fullLabel,
          });
        }
      }
    });
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, rec] of rawLessonsMap.entries()) {
      if (stuckSet.has(id)) continue;

      const text = extractVisibleText(rec);
      let refsStuck = false;

      for (const stuckId of stuckSet) {
        const info = lessonInfoMap.get(stuckId);
        if (!info) continue;

        if (referencesLesson(text, info.partLetter, info.lessonNum)) {
          refsStuck = true;
          break;
        }
      }

      if (refsStuck) {
        stuckSet.add(id);
        changed = true;
      }
    }
  }

  return { stuckSet, originalLabels, lessonInfoMap };
}

export function buildRelabeler(curriculum, stuckSet) {
  const originalLabels = computeLabels(curriculum);
  const newLabels = computeLabels(curriculum, {
    filterLessonId: (id) => !stuckSet.has(id),
    omitEmptyModules: true,
  });

  const moduleByOrigLetter = new Map();
  const modules = curriculum.modules ?? [];

  for (const mod of modules) {
    const rawLessons = mod.lessons ?? [];
    const origModuleLabel = originalLabels.modules[mod.module_id];
    const newModuleLabel = newLabels.modules[mod.module_id];

    const origLetterMatch = origModuleLabel?.match(/^Part\s+([A-Z])$/);
    const origLetter = origLetterMatch ? origLetterMatch[1] : null;

    const newLetterMatch = newModuleLabel?.match(/^Part\s+([A-Z])$/);
    const newLetter = newLetterMatch ? newLetterMatch[1] : null;

    const lessonNumMap = new Map();
    rawLessons.forEach((l, origIdx) => {
      const origNum = origIdx + 1;
      const newLabel = newLabels.lessons[l.lesson_id];
      if (newLabel) {
        const nMatch = newLabel.match(/^Part\s+[A-Z],\s*Bài\s+(\d+)$/);
        if (nMatch) {
          lessonNumMap.set(origNum, parseInt(nMatch[1], 10));
        }
      }
    });

    if (origLetter) {
      moduleByOrigLetter.set(origLetter, {
        moduleId: mod.module_id,
        origLetter,
        newLetter, // có thể null nếu module bị loại bỏ hoàn toàn
        origModuleLabel,
        newModuleLabel,
        lessonNumMap,
      });
    }
  }

  // Hàm thay thế văn bản 1-pass bảo vệ collision
  return function relabelText(text) {
    if (!text || typeof text !== "string") return text;
    let result = text;

    // 1. Dạng gộp: Part X (Bài 1, Bài 3) hoặc Part X (1, 3)
    result = result.replace(/\bPart\s+([A-Z])\s*\(([^)]+)\)/gi, (match, letter, innerList) => {
      const upperLetter = letter.toUpperCase();
      const m = moduleByOrigLetter.get(upperLetter);
      if (!m) return match;

      const targetLetter = m.newLetter || m.origLetter;

      const updatedInner = innerList.replace(/(\bBài\s*)?(\d+)\b/gi, (subMatch, prefix, numStr) => {
        const oldNum = parseInt(numStr, 10);
        const newNum = m.lessonNumMap.get(oldNum);
        if (newNum !== undefined) {
          return (prefix || "") + newNum;
        }
        return subMatch;
      });

      return `__CORELIA_PART_GROUP__${targetLetter}__START__(${updatedInner})__CORELIA_PART_GROUP__END__`;
    });

    // 2. Dạng đơn: Part X, Bài N
    result = result.replace(/\bPart\s+([A-Z])\s*,\s*Bài\s+(\d+)\b/gi, (match, letter, numStr) => {
      const upperLetter = letter.toUpperCase();
      const m = moduleByOrigLetter.get(upperLetter);
      if (!m) return match;

      const targetLetter = m.newLetter || m.origLetter;
      const oldNum = parseInt(numStr, 10);
      const newNum = m.lessonNumMap.get(oldNum);
      const finalNum = newNum !== undefined ? newNum : oldNum;

      return `__CORELIA_PART_SINGLE__${targetLetter}__NUM__${finalNum}__END__`;
    });

    // 3. Dạng Part độc lập: Part X đổi thành Part Y khi module trước bị kẹt toàn bộ
    result = result.replace(/\bPart\s+([A-Z])\b/g, (match, letter) => {
      const upperLetter = letter.toUpperCase();
      const m = moduleByOrigLetter.get(upperLetter);
      if (!m || !m.newLetter || m.newLetter === m.origLetter) return match;
      return `__CORELIA_PART_STANDALONE__${m.newLetter}__END__`;
    });

    // 4. Khôi phục placeholder về chuỗi hoàn chỉnh
    result = result.replace(/__CORELIA_PART_GROUP__([A-Z])__START__\(([^)]+)\)__CORELIA_PART_GROUP__END__/g, "Part $1 ($2)");
    result = result.replace(/__CORELIA_PART_SINGLE__([A-Z])__NUM__(\d+)__END__/g, "Part $1, Bài $2");
    result = result.replace(/__CORELIA_PART_STANDALONE__([A-Z])__END__/g, "Part $1");

    return result;
  };
}

export function relabelObject(obj, relabelTextFn) {
  if (!obj) return obj;
  if (typeof obj === "string") {
    return relabelTextFn(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => relabelObject(item, relabelTextFn));
  }
  if (typeof obj === "object") {
    const res = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = relabelObject(v, relabelTextFn);
    }
    return res;
  }
  return obj;
}
