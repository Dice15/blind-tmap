'use client'

import { useEffect } from "react";

export default function ViewportHeightSetter() {
    useEffect(() => {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty("--vh", `${vh}px`);
    });

    return (<></>);
}