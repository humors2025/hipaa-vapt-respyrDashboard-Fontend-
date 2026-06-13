"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { resetPasswordService } from "@/services/authService";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ForgotPassword({ email }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Validate passwords match
  useEffect(() => {
    if (password && confirmPassword && password !== confirmPassword) {
      setPasswordError("Passwords do not match");
    } else {
      setPasswordError("");
    }
  }, [password, confirmPassword]);

  const handleReset = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await resetPasswordService(email, password);
      toast.success(res.message || "Password updated successfully.");
      setTimeout(() => {
        router.push("/login");
      }, 1000);
    } catch (error) {
        toast.error(error.data?.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="mx-auto w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Enter your new password for
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleReset}>
          <div>
            <Label htmlFor="email" className="block text-sm font-medium mb-2">
              Email address
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              className="w-full"
              disabled
            />
          </div>

          <div>
            <Label htmlFor="password" className="block text-sm font-medium mb-2">
              New Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full"
            />
            {passwordError && (
              <p className="mt-1 text-sm text-red-600">{passwordError}</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full cursor-pointer border border-transparent hover:bg-white hover:text-black hover:border-[#308BF9] transition" 
            disabled={loading || password !== confirmPassword || !password || !confirmPassword}
          >
            {loading ? "Resetting..." : "Reset password"}
          </Button>
        </form>

        <div className="flex justify-center">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50"
            prefetch={false}
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
