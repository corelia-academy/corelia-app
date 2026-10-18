import { useState } from "react";
import { submitForm } from "@/lib/submitForm";

type Props = {
  submitText: string;
  submittingText: string;
  successText: string;
  errorText: string;
};

const EmailInput = ({ submitText, submittingText, successText, errorText }: Props) => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === "submitting") return;

    setStatus("submitting");
    try {
      await submitForm({ formType: "subscribe", email });
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="flex items-center bg-muted py-2 pr-2 pl-4 rounded-[20px] text-[14px] gap-[20px] max-w-[330px]"
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          placeholder="terran@corelia.academy"
          className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          disabled={status === "success"}
        />
        <button
          type="submit"
          disabled={status === "submitting" || status === "success"}
          className="bg-primary text-primary-foreground rounded-[12px] cursor-pointer hover:bg-secondary hover:text-secondary-foreground transition-all duration-300 py-3 px-9 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {status === "submitting" ? submittingText : submitText}
        </button>
      </form>
      {status === "success" && (
        <p className="text-green-500 text-xs mt-2">{successText}</p>
      )}
      {status === "error" && (
        <p className="text-red-500 text-xs mt-2">{errorText}</p>
      )}
    </div>
  );
};

export default EmailInput;
