import { useEffect, useState } from "react";

/*****************************************************************
 * HTML 요소의 dimensions (width와 height)를 관리하는 React Hook입니다.
 *****************************************************************/

/** HTML 요소의 dimensions (width와 height) 인터페이스 */
interface HtmlElementDimensions {
    width: number;
    height: number;
}

/**
 * useElementDimensions Hook은 HTML 요소의 dimensions (width와 height)를 반환합니다.
 *
 * 이 Hook은 dimensionType에 따라 요소의 dimensions을 계산합니다.
 * "Default"는 padding과 border를 포함한 dimensions을,
 * "Pure"는 padding과 border를 제외한 순수한 dimensions을 반환합니다.
 *
 * @param {React.RefObject<T>} htmlElement - dimensions을 가져올 HTML 요소의 참조입니다.
 * @param {"Default" | "Pure"} dimensionType - dimensions 계산 방식을 지정합니다.
 *        "Default"는 padding과 border를 포함, "Pure"는 이들을 제외합니다.
 * @returns {[number, number]} HTML 요소의 width와 height를 반환합니다.
 */
export default function useElementDimensions<T extends HTMLElement>(htmlElement: React.RefObject<T>, dimensionType: "Default" | "Pure"): {
    width: number;
    height: number;
} {
    // HTML 요소의 현재 dimensions를 상태로 관리
    const [dimensions, setDimensions] = useState<HtmlElementDimensions>({ width: 0, height: 0 });

    // dimensions 타입에 따라 적절한 함수 선택
    const getDimensions = dimensionType === "Default" ? getDefaultDimensions : getPureDimensions;

    useEffect(() => {
        // 관찰 대상 요소
        const currentElement = htmlElement.current;
        let frameId: number | null = null;

        // ResizeObserver 콜백, 요소의 크기 변화 감지
        const observerCallback = () => {
            const newDimensions: HtmlElementDimensions = getDimensions(htmlElement);

            // 크기가 변경된 경우 상태 업데이트
            if (
                dimensions.width !== newDimensions.width ||
                dimensions.height !== newDimensions.height
            ) {
                if (frameId) {
                    cancelAnimationFrame(frameId);
                }
                frameId = requestAnimationFrame(() => {
                    setDimensions(newDimensions);
                });
            }
        };

        // ResizeObserver 설정 및 실행
        const observer = new ResizeObserver(observerCallback);

        if (currentElement) {
            observer.observe(currentElement);
        }

        // 정리 작업
        return () => {
            if (currentElement) {
                observer.unobserve(currentElement);
            }
            if (frameId) {
                cancelAnimationFrame(frameId);
            }
        };
    }, [dimensions, getDimensions, htmlElement]);

    return dimensions;
}

/**
 * getDefaultDimensions 함수는 요소의 dimensions을 가져옵니다.
 * 이 dimensions은 padding과 border를 포함한 값입니다.
 *
 * @param {React.RefObject<HTMLElement>} htmlElement - dimensions을 가져올 HTML 요소의 참조입니다.
 * @returns {HtmlElementDimensions} 요소의 dimensions을 반환합니다.
 */
function getDefaultDimensions(htmlElement: React.RefObject<HTMLElement>): HtmlElementDimensions {
    if (htmlElement.current) {
        return {
            width: htmlElement.current.getBoundingClientRect().width || 0,
            height: htmlElement.current.getBoundingClientRect().height || 0,
        };
    }
    return { width: 0, height: 0 };
}

/**
 * getPureDimensions 함수는 요소의 순수한 dimensions만을 가져옵니다.
 * 이 dimensions은 padding과 border를 제외한 순수한 값입니다.
 *
 * @param {React.RefObject<HTMLElement>} htmlElement - dimensions을 가져올 HTML 요소의 참조입니다.
 * @returns {HtmlElementDimensions} 요소의 순수한 dimensions을 반환합니다.
 */
function getPureDimensions(htmlElement: React.RefObject<HTMLElement>): HtmlElementDimensions {
    if (htmlElement.current) {
        const styles = window.getComputedStyle(htmlElement.current);

        const width = htmlElement.current.getBoundingClientRect().width || 0;
        const height = htmlElement.current.getBoundingClientRect().height || 0;

        const paddingX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
        const paddingY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);

        const borderX = parseFloat(styles.borderLeftWidth) + parseFloat(styles.borderRightWidth);
        const borderY = parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);

        return {
            width: width - (paddingX + borderX), // padding과 border를 제외한 너비
            height: height - (paddingY + borderY), // padding과 border를 제외한 높이
        };
    }
    return { width: 0, height: 0 };
}