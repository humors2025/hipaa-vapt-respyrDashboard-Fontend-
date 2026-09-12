export const metadata = { title: "Welcome to Rysflo" };

export default function OrderSuccessPage() {
  return (
    <main className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-[16px] p-8 max-w-[560px] w-full flex flex-col gap-4 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-[#E5F6EE] text-[#1F7A4A] text-[22px] flex items-center justify-center">✓</div>
        <h1 className="text-[#252525] text-[24px] font-bold">You&rsquo;re in.</h1>
        <p className="text-[#535359] text-[14px]">
          Your Rysflo membership is active and your device is on its way. We&rsquo;ve emailed your receipt.
        </p>
        <ol className="text-left text-[#535359] text-[13px] flex flex-col gap-2 list-decimal pl-5 mt-2">
          <li>Download the Rysflo app and sign up with the <strong>same email</strong> you just used.</li>
          <li>When the device arrives, pair it in the app and take your first reading.</li>
          <li>Every reading day takes 20¢ off next month&rsquo;s bill — up to $6.</li>
        </ol>
        <p className="text-[#A1A1A1] text-[11px] mt-2">Questions? Reply to your receipt email and we&rsquo;ll help.</p>
      </div>
    </main>
  );
}
