import { requireUser } from "@/lib/auth/session";
import { UploadForm } from "./upload-form";

export const metadata = { title: "Upload · Proposal Evaluator" };

export default async function NewProposalPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Upload a proposal</h1>
        <p className="mt-1 text-sm text-stone-600">
          Not sure what to upload?{" "}
          <a href="/proposal-template.md" download className="underline">
            Download the template
          </a>{" "}
          and fill it in.
        </p>
      </div>
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
        Upload synthetic or publicly available documents only. Your file&apos;s text is stored
        and, in later steps, sent to an AI model for scoring. You can delete it at any time.
      </p>
      <UploadForm />
    </div>
  );
}
