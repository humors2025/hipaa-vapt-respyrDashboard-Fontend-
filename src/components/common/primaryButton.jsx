import React from 'react'

export const PrimaryButton = () => {
  return (
   <>
   <Button type="submit" 
                   className="w-full cursor-pointer border border-transparent hover:bg-white hover:text-black hover:border-[#308BF9] transition" 
                   disabled={loading}>
                     {loading ? "Logging in..." : "Login"}
                   </Button>
   </>
  )
}
