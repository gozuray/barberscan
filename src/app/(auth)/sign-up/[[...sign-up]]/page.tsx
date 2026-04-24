import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream px-4">
      <SignUp appearance={{ elements: { card: "shadow-luxe" } }} />
    </div>
  );
}
