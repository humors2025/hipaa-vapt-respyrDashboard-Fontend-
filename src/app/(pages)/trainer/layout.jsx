import TrainerHeaderSwitch from "@/components/TrainerHeaderSwitch";
import PayoutSetupReminder from "@/components/earnings/PayoutSetupReminder";

export default function TrainerLayout({ children }) {
  return (
    <>
      <TrainerHeaderSwitch />
      <PayoutSetupReminder />
      {children}
    </>
  );
}
