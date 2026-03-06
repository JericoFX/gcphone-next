import {
    u as y,
    r,
    s as o,
    aW as ve,
    a0 as V,
    A as x,
    aX as N,
    P as A,
    ay as J,
    q as l,
    C as U,
    a as n,
    F as ee,
    j as g,
    aY as pe,
    aZ as Ce,
    a_ as be,
    a$ as ye,
    V as Ae,
    O as Se,
    m as te,
    b0 as ke,
    L as ae,
    t as S,
    b1 as Ie,
    b2 as Re,
    a4 as Pe,
    v as Ne,
    a9 as Oe,
    b3 as Ee,
    b as we,
    U as Le
} from "./index-99e0aeb1.js";

function Fe() {
    var Y;
    const K = y(we),
        T = y(N.Unlocked),
        se = y(N.PassedFaceId),
        p = y(N.Visible),
        [O, C] = r.useState(!1),
        [c, E] = r.useState("Photo"),
        [k, Z] = r.useState(!1),
        [ne, D] = r.useState(!1),
        [G, I] = r.useState(null),
        [h, z] = r.useState(!1),
        [X, re] = r.useState(!1),
        [m, w] = r.useState(!1),
        [ie, j] = r.useState(0),
        [R, oe] = r.useState([.5, 1, 2, 5]),
        [B, H] = r.useState(1),
        [ce, le] = r.useState(1),
        ue = !R.includes(B),
        [de, L] = r.useState({}),
        u = y(Le),
        d = y(x),
        $ = r.useRef(null),
        F = r.useRef(null),
        P = r.useRef(null),
        i = r.useRef(null),
        v = r.useRef(!1),
        f = ["Video", "Photo", "Landscape"],
        Q = () => {
            c === "Photo" && h && !K.CustomCamera ? i.current.setXOffset(-.2) : h && K.CustomCamera ? i.current.setXOffset(.1) : i.current.setXOffset(0)
        },
        me = () => {
            if (o("info", "Camera app is active & open, initializing game render & audio stream"), l("Camera", {
                    action: "open"
                }), i.current && i.current.resume(), l("Camera", {
                    action: "flipCamera",
                    value: h
                }, "OK"), S.APPS.CAMERA.lastImage.value) return M(S.APPS.CAMERA.lastImage.value);
            l("Camera", {
                action: "getLastImage"
            }, Re.Photos[0].src).then(e => {
                e && M(e)
            })
        },
        fe = () => {
            o("info", "Camera app is not active or open, pausing game render & releasing audio stream"), l("Camera", {
                action: "close"
            }), m && w(!1), i.current && i.current.pause()
        };
    r.useEffect(() => {
        var a, t;
        const e = !(u != null && u.visible) && ((a = d == null ? void 0 : d.active) == null ? void 0 : a.name) === "Camera" && p;
        v.current !== e && (v.current = e, o("info", "Camera app active:", e, u == null ? void 0 : u.visible, (t = d == null ? void 0 : d.active) == null ? void 0 : t.name, p), e ? me() : fe())
    }, [u == null ? void 0 : u.visible, (Y = d == null ? void 0 : d.active) == null ? void 0 : Y.name, i.current, p]), r.useEffect(() => {
        P.current && v.current && (i.current || (o("info", "Initializing game render"), i.current = new ve(P.current)))
    }, [P.current]), r.useEffect(() => () => {
        o("info", "Cleaning up camera app"), i.current && (o("info", "Destroying game render"), i.current.destroy(), i.current = null)
    }, []), V("camera:setZoom", e => {
        H(e);
        let a = R.reduce((t, s) => s <= e && s > t ? s : t, 0);
        le(a)
    }), V("camera:setZoomLevels", e => oe(e)), V("camera:usedCommand", e => {
        var a;
        if (u != null && u.visible || ((a = d == null ? void 0 : d.active) == null ? void 0 : a.name) !== "Camera" || !p) return o("info", "camera:usedCommand - camera is not active, returning");
        switch (e) {
            case "toggleTaking":
                _();
                break;
            case "toggleFlip":
                z(t => !t);
                break;
            case "toggleFlash":
                Z(t => !t);
                break;
            case "leftMode":
                if (m) return;
                E(t => {
                    const s = f.indexOf(t);
                    return s === 0 ? f[f.length - 1] : f[s - 1]
                });
                break;
            case "rightMode":
                if (m) return;
                E(t => {
                    const s = f.indexOf(t);
                    return s === f.length - 1 ? f[0] : f[s + 1]
                });
                break
        }
    }), r.useEffect(() => {
        if (!F.current) return;
        let e = [];
        const t = setInterval(() => {
            e.length > 2 && (e = []), e.push("."), F.current.innerText = ae("APPS.CAMERA.UPLOADING") + e.join("")
        }, 500);
        return () => clearInterval(t)
    }, [O]);
    const M = (e, a) => {
        if (a === void 0 && (a = Pe(e)), a) {
            const t = document.createElement("video");
            t.src = e, t.muted = !0, t.play().catch(() => {});
            const s = document.createElement("canvas");
            if (!s) return;
            t.addEventListener("loadeddata", () => {
                s.width = t.videoWidth, s.height = t.videoHeight, s.getContext("2d").drawImage(t, 0, 0, s.width, s.height);
                const b = s.toDataURL("image/png");
                $.current.style.backgroundImage = `url(${b})`, S.APPS.CAMERA.lastImage.set(b), s.remove(), t.remove()
            })
        } else $.current.style.backgroundImage = `url(${e})`, S.APPS.CAMERA.lastImage.set(e)
    };
    r.useEffect(() => {
        if (!p) return () => {
            x.patch({
                active: null
            }), T || N.LockScreenVisible.set(!0)
        }
    }, [p]), r.useEffect(() => {
        var a, t;
        if (m || !i.current || !v.current) return;
        switch (c) {
            case "Landscape":
                if ((a = J) != null && a.value) return;
                L({
                    marginRight: "9rem"
                }), A.Styles.Rotation.set(90);
                break;
            case "Video":
                A.Styles.Rotation.set(0), L({
                    marginLeft: "12rem"
                });
                break;
            default:
                A.Styles.Rotation.set(0), L({
                    marginLeft: "3rem"
                });
                break
        }
        if (c === "Landscape") {
            if ((t = J) != null && t.value) return;
            i.current.resizeByAspect(16 / 9)
        } else(c === "Video" || c === "Photo") && i.current.resizeByAspect(3 / 4);
        l("Camera", {
            action: "toggleLandscape",
            toggled: c === "Landscape"
        }, "OK"), l("Camera", {
            action: "toggleVideo",
            toggled: c === "Video"
        }, "OK");
        const e = window.innerWidth;
        e > 1920 && i.current.setQuality(1920 / e), Q()
    }, [c, v.current]), r.useEffect(() => {
        if (!v.current) return o("info", "camera app is not active, not triggering flipCamera");
        l("Camera", {
            action: "flipCamera",
            value: h
        }, "OK"), Q()
    }, [h]);
    const W = r.useRef(!0),
        q = async (e, a) => {
            const t = Ne(e.size / 1e3, 2);
            k && l("toggleFlashlight", {
                toggled: !1
            }, "OK");
            try {
                const s = await Oe(a ? "Video" : "Image", e);
                if (!s) throw new Error("Failed to upload media (URL is null)");
                return M(s), o("info", `Saving ${a?"video":"photo"} to gallery (${t}kb) - ${s}, args(${s}, ${t}, ${h&&!a?"selfie":null})`), await Ee(s, t, h && !a ? "selfie" : null, !0), !0
            } catch (s) {
                throw s
            }
        };
    r.useEffect(() => {
        if (W.current) {
            W.current = !1;
            return
        }
        if (k && !m && l("toggleFlashlight", {
                toggled: !1
            }, "OK"), !m) return;
        const e = i.current.startRecording(async t => {
                if (m && w(!1), !v.current) return o("info", "camera app is not active, not saving video");
                C(!0);
                try {
                    await q(t, !0), o("info", "Video uploaded successfully"), C(!1)
                } catch (s) {
                    o("error", "Could not upload video", s), C(!1), I(s.message), await new Promise(b => setTimeout(b, 1e4)), I(null)
                }
            }),
            a = setInterval(() => {
                j(t => t + 1)
            }, 1e3);
        return () => {
            j(0), clearInterval(a), e && e.state === "recording" && e.stop()
        }
    }, [m]);
    const ge = e => {
            let a = (e % 60).toString().padStart(2, "0"),
                t = (Math.floor(e / 60) % 60).toString().padStart(2, "0");
            return Math.floor(e / 3600).toString().padStart(2, "0") + ":" + t + ":" + a
        },
        he = e => {
            l("Camera", {
                action: "setQuickZoom",
                value: e
            }, "OK").then(() => {
                H(e)
            })
        },
        _ = async () => {
            var a, t;
            if (O) return o("info", "Returning since an image is currently uploading");
            if (k && await l("toggleFlashlight", {
                    toggled: !0
                }, "OK"), c == "Video") {
                await l("Camera", {
                    action: "toggleHud",
                    toggled: m
                }, "OK"), w(s => !s);
                return
            }(t = (a = A.Settings.value) == null ? void 0 : a.sound) != null && t.silent || A.SoundManager.set({
                url: "./assets/sound/other/cameraShutter.mp3"
            }), D(!0), U.IndicatorVisible.set(!1), C(!0), o("info", "Uploading image, converting to blob");
            const e = await i.current.takePhoto();
            try {
                await q(e, !1), o("info", "Image uploaded successfully"), C(!1), U.IndicatorVisible.set(!0)
            } catch (s) {
                o("error", "Could not upload image", s), C(!1), I(s.message), U.IndicatorVisible.set(!0), await new Promise(b => setTimeout(b, 1e4)), I(null)
            }
            D(!1)
        };
    return n(ee, {
        children: g("div", {
            className: "camera-container",
            children: [g("div", {
                className: "camera-header",
                children: [n("div", {
                    className: "flash",
                    onClick: () => Z(e => !e),
                    children: !m && k ? n(pe, {}) : n(Ce, {})
                }), c === "Video" && n(ee, {
                    children: n("div", {
                        className: "timer",
                        children: ge(ie)
                    })
                }), n("div", {
                    className: "grid-toggle",
                    onClick: () => re(e => !e),
                    children: X ? n(be, {}) : n(ye, {})
                })]
            }), g("div", {
                className: Ae("camera-body", c == "Landscape" && "rotate"),
                children: [n("canvas", {
                    ref: P,
                    style: {
                        visibility: ne ? "hidden" : "visible"
                    }
                }), n(Se, {
                    children: X && n(te.div, {
                        initial: {
                            opacity: 0
                        },
                        animate: {
                            opacity: 1
                        },
                        exit: {
                            opacity: 0
                        },
                        transition: {
                            duration: .1,
                            ease: "easeInOut"
                        },
                        className: "grid",
                        children: Array.from({
                            length: 9
                        }).map((e, a) => n("div", {
                            className: "grid-item"
                        }, a))
                    })
                }), R.length > 0 && n("div", {
                    className: "quick-zoom",
                    children: R.map(e => {
                        let a = ce === e;
                        return g(te.div, {
                            animate: {
                                width: a ? "1.75rem" : "1.35rem",
                                height: a ? "1.75rem" : "1.35rem"
                            },
                            transition: {
                                duration: .2,
                                ease: "easeInOut"
                            },
                            className: "item",
                            "data-active": a,
                            onClick: () => he(e),
                            children: [a && ue ? B : e, a && n("span", {
                                children: "x"
                            })]
                        }, `${a}-${e}`)
                    })
                }), O && g("div", {
                    className: "camera-loading",
                    children: [n(ke, {
                        size: 80,
                        speed: 1,
                        color: "#ffffff"
                    }), n("div", {
                        className: "uploading",
                        ref: F,
                        children: "Uploading..."
                    })]
                }), G && n("div", {
                    className: "camera-loading",
                    children: g("div", {
                        className: "uploading",
                        children: ["Failed to upload, tell the server owner to check their API keys in lb-phone/server/apiKeys.lua", n("br", {}), n("br", {}), G]
                    })
                })]
            }), g("div", {
                className: "camera-bottom",
                children: [n("div", {
                    className: "camera-types",
                    style: de,
                    children: f.map((e, a) => n("div", {
                        className: `${c===e&&"active"}`,
                        onClick: () => E(e),
                        children: ae(`APPS.CAMERA.${e.toUpperCase()}`)
                    }, a))
                }), g("div", {
                    className: "camera-buttons",
                    children: [n("div", {
                        className: "image-gallery",
                        ref: $,
                        onClick: () => {
                            !se && !T || (l("Camera", {
                                action: "close"
                            }, "OK"), A.Styles.Rotation.set(0), x.patch({
                                active: {
                                    name: "Photos",
                                    data: {
                                        photo: S.APPS.CAMERA.lastImage.value
                                    }
                                }
                            }))
                        }
                    }), n("div", {
                        className: "camera-button",
                        onClick: () => _(),
                        children: n("div", {
                            className: "camera-button-container",
                            children: n("div", {
                                className: `camera-button-inner ${c=="Video"&&`${c} ${m==!0&&"Recording"}`}`
                            })
                        })
                    }), n("div", {
                        className: "flip-camera",
                        onClick: () => z(e => !e),
                        children: n(Ie, {})
                    })]
                })]
            })]
        })
    })
}
export {
    Fe as
    default
};