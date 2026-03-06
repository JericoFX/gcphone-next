import {
    j as s,
    V as h,
    a as c,
    d as a
} from "./index-99e0aeb1.js";

function d(e) {
    return s("label", {
        className: h("switch", e.theme ?? "light"),
        children: [e.disabled ? c(a, {
            type: "checkbox",
            checked: e.checked,
            disabled: !0
        }) : c(a, {
            type: "checkbox",
            checked: e.checked,
            onChange: e.onChange
        }), c("span", {
            className: "slider round"
        })]
    })
}
export {
    d as S
};