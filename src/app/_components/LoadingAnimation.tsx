"use client"

import styled, { keyframes } from "styled-components";


/** 로딩 애니메이션 컴포넌트 프로퍼티 */
export interface LoadingAnimationProps {
    active: boolean;
}


/** 로딩 애니메이션 컴포넌트 */
export default function LoadingAnimation({ active }: LoadingAnimationProps) {
    return (
        <Wrapper style={{ visibility: `${active ? "visible" : "hidden"}` }}>
            <Loader />
        </Wrapper>
    );
}


const Wrapper = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    height: calc(var(--vh, 1vh) * 100);
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100;
    background-color: rgba(70, 70, 70, 0.7);
`;

const spin = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

const Loader = styled.div`
    border: 10px solid #f3f3f3;
    border-top: 10px solid #2b2b2b;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: ${spin} 1s linear infinite;
`;