/**
 * After deploying the Google Apps Script Web App,
 * replace this placeholder with your actual deployment URL.
 * It looks like: https://script.google.com/macros/s/XXXXXXXXX/exec
 */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYOTY_sZExtJR9kjlZD9H_GPOinUERbH5dktrbDbDH8tAqCkwCiN_NFoSJPqqQ0bsqJg/exec";

export type ContactData = {
  formType: "contact";
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

export type SubscribeData = {
  formType: "subscribe";
  email: string;
};

export type FormData = ContactData | SubscribeData;

export async function submitForm(data: FormData): Promise<{ result: string }> {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const json = await res.json();

  if (json.result !== "success") {
    throw new Error(json.message || "Submission failed");
  }

  return json;
}
