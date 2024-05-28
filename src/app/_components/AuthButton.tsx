"use client"

import { signIn, signOut } from "next-auth/react";
import React, { ReactElement } from "react";

interface AuthButtonProps {
    isAuth: boolean;
    authButtons: {
        signInButton: ReactElement;
        signOutButton: ReactElement;
    };
}

export default function AuthButton({ isAuth, authButtons }: AuthButtonProps) {
    // 선택된 버튼에 onClick 이벤트 추가
    const authButton = React.cloneElement(
        isAuth ? authButtons.signOutButton : authButtons.signInButton,
        { onClick: isAuth ? () => signOut() : () => signIn() }
    );

    // Render
    return (
        <>
            {authButton}
        </>
    );
}
