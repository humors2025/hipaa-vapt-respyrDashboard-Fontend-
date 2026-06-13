"use client"

import AllChats from "@/components/all-chats"
import ChatProfile from "@/components/chatprofile"
import ProtectedRoute from "@/components/ProtectedRoute"

export default function Messages(){
    return(
        <>
    <ProtectedRoute>
        <div className="flex gap-5">
        <AllChats/>
        <ChatProfile/>
        </div>
        </ProtectedRoute>
        </>
    )
};