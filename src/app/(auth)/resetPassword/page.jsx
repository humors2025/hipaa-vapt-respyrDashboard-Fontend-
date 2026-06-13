
import  ResetPassword  from "@/components/reset-password"

export default function Page() {
  return (
<div 
className="flex items-center pl-[25px] w-full min-h-screen"
 style={{
        backgroundImage: "url('/icons/dietician_image_freepik.jpg')", 
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
>
        <ResetPassword/>
      </div>
    
  );
}
