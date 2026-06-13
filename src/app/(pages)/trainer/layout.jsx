import TrainerHeaderSwitch from "@/components/TrainerHeaderSwitch";

export default function TrainerLayout({ children }) {
  return (
    <>
      <TrainerHeaderSwitch />
      {children}
    </>
  );
}
