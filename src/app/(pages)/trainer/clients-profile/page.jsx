"use client";

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from "next/navigation";
import Cookies from "js-cookie";
import ClientDetails from "@/components/client-details";
import ClientLists from "@/components/client-lists";
import {
    setSuperAdminPartnerCode,
    clearSuperAdminPartnerCode,
} from "@/lib/superAdminContext";

function decodeJwt(token) {
    try {
        const payload = token.split(".")[1];
        const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split("")
                .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
                .join("")
        );
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
}

function PartnerCodeSync({ isSuperAdmin }) {
    const searchParams = useSearchParams();
    const partnerCode = searchParams.get("partner_code");

    useEffect(() => {
        if (isSuperAdmin && partnerCode) {
            setSuperAdminPartnerCode(partnerCode);
        }
        return () => {
            clearSuperAdminPartnerCode();
        };
    }, [isSuperAdmin, partnerCode]);

    return null;
}

export default function ClientsProfile() {
    const [roleChecked, setRoleChecked] = useState(false);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    useEffect(() => {
        const token = Cookies.get("access_token");
        const decoded = token ? decodeJwt(token) : null;
        setIsSuperAdmin(decoded?.role === "super_admin");
        setRoleChecked(true);
    }, []);

    return(
        <Suspense fallback={null}>
            {roleChecked && <PartnerCodeSync isSuperAdmin={isSuperAdmin} />}
            <div className="flex gap-5 h-[85vh] overflow-hidden ">
                {roleChecked && <ClientLists/>}
                <ClientDetails/>
            </div>
        </Suspense>
    )

}
