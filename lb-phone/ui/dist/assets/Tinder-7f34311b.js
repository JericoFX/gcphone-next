import {
    al as xe,
    aq as O,
    r as g,
    j as a,
    a as e,
    bQ as Le,
    h as _e,
    G as ne,
    q as x,
    O as we,
    m as ye,
    L as m,
    d as F,
    a6 as X,
    cy as Oe,
    cs as Ve,
    u as z,
    P as B,
    F as $,
    I as Fe,
    f as Ue,
    cz as Z,
    bD as ee,
    C as W,
    b as te,
    ax as Se,
    s as J,
    t as H,
    J as $e,
    K as We,
    a0 as Te,
    cl as He,
    a5 as Y,
    ab as Ne,
    a4 as re,
    o as be,
    aR as Be,
    cc as Ge,
    V as Ye,
    x as ze,
    ca as he,
    ao as Ke,
    aX as ie,
    aa as je,
    b0 as Je
} from "./index-99e0aeb1.js";
import {
    T as Me
} from "./Textarea-88ad0a75.js";
var qe = function(s) {
    return new Promise(function(l) {
        setTimeout(l, s)
    })
};
const ue = xe(qe),
    k = {
        snapBackDuration: 300,
        maxTilt: 5,
        bouncePower: .1,
        swipeThreshold: 100
    },
    Xe = t => {
        const s = window.getComputedStyle(t),
            l = s.getPropertyValue("width"),
            u = Number(l.split("px")[0]),
            E = s.getPropertyValue("height"),
            y = Number(E.split("px")[0]);
        return {
            x: u,
            y
        }
    },
    Pe = (t, s) => Math.sqrt(Math.pow(t, 2) + Math.pow(s, 2)),
    Qe = (t, s = 1) => {
        const l = Math.sqrt(Math.pow(t.x, 2) + Math.pow(t.y, 2));
        return {
            x: t.x * s / l,
            y: t.y * s / l
        }
    },
    ce = async (t, s, l = !1) => {
        const u = se(t),
            E = Xe(document.body),
            y = Pe(E.x, E.y),
            n = Pe(s.x, s.y),
            v = y / n,
            c = y / n,
            p = me(s.x * c + u.x, -s.y * c + u.y);
        let h = "";
        const i = 200;
        l ? t.style.transition = "ease " + v + "s" : t.style.transition = "ease-out " + v + "s", K(t) === 0 ? h = j((Math.random() - .5) * i) : K(t) > 0 ? h = j(Math.random() * i / 2 + K(t)) : h = j((Math.random() - 1) * i / 2 + K(t)), t.style.transform = p + h, await ue(v * 1e3)
    }, Ee = async t => {
        t.style.transition = k.snapBackDuration + "ms";
        const s = se(t),
            l = me(s.x * -k.bouncePower, s.y * -k.bouncePower),
            u = j(K(t) * -k.bouncePower);
        t.style.transform = l + u, await ue(k.snapBackDuration * .75), t.style.transform = "none", await ue(k.snapBackDuration), t.style.transition = "10ms"
    }, Ie = t => {
        if (Math.abs(t.x) > Math.abs(t.y)) {
            if (t.x > k.swipeThreshold) return "right";
            if (t.x < -k.swipeThreshold) return "left"
        } else {
            if (t.y > k.swipeThreshold) return "up";
            if (t.y < -k.swipeThreshold) return "down"
        }
        return "none"
    }, Ae = (t, s) => {
        const l = s.x - t.x,
            u = t.y - s.y,
            E = (s.time - t.time) / 1e3;
        return {
            x: l / E,
            y: u / E
        }
    }, me = (t, s) => "translate(" + t + "px)", j = t => "rotate(" + t + "deg)", se = t => {
        const s = window.getComputedStyle(t),
            l = new DOMMatrix(s.transform);
        return {
            x: l.m41,
            y: -l.m42
        }
    }, K = t => {
        const s = window.getComputedStyle(t),
            l = new DOMMatrix(s.transform);
        return -Math.asin(l.m21) / (2 * Math.PI) * 360
    }, Ze = (t, s, l, u) => {
        const E = {
                x: t.x + l.x,
                y: t.y + l.y
            },
            y = {
                x: E.x,
                y: E.y,
                time: new Date().getTime()
            },
            n = me(E.x),
            v = Ae(u, y).x / 1e3,
            c = j(v * k.maxTilt);
        return s.style.transform = n + c, y
    }, le = t => {
        const s = t.targetTouches[0];
        return {
            x: s.clientX,
            y: s.clientY
        }
    }, de = t => ({
        x: t.clientX,
        y: t.clientY
    }), et = O.forwardRef(({
        flickOnSwipe: t = !0,
        children: s,
        onSwipe: l,
        onCardLeftScreen: u,
        className: E,
        preventSwipe: y = [],
        swipeRequirementType: n = "velocity",
        swipeThreshold: v = k.swipeThreshold,
        onSwipeRequirementFulfilled: c,
        onSwipeRequirementUnfulfilled: p
    }, h) => {
        k.swipeThreshold = v;
        const i = O.useRef(!1),
            d = O.useRef();
        O.useImperativeHandle(h, () => ({
            async swipe(M = "right") {
                l && l(M);
                const T = 1e3,
                    o = (Math.random() - .5) * 100;
                M === "right" ? await ce(d.current, {
                    x: T,
                    y: o
                }, !0) : M === "left" && await ce(d.current, {
                    x: -T,
                    y: o
                }, !0), d.current.style.display = "none", u && u(M)
            },
            async restoreCard() {
                d.current.style.display = "block", await Ee(d.current)
            }
        }));
        const r = O.useCallback(async (M, T) => {
                if (i.current) return;
                i.current = !0;
                const o = se(M),
                    b = Ie(n === "velocity" ? T : o);
                if (b !== "none" && (l && l(b), t && !y.includes(b))) {
                    const f = n === "velocity" ? T : Qe(o, 600);
                    await ce(M, f), M.style.display = "none", u && u(b);
                    return
                }
                Ee(M)
            }, [i, t, l, u, y, n]),
            I = O.useCallback(() => {
                i.current = !1
            }, [i]);
        return O.useLayoutEffect(() => {
            let M = {
                    x: null,
                    y: null
                },
                T = {
                    x: 0,
                    y: 0
                },
                o = {
                    x: 0,
                    y: 0,
                    time: new Date().getTime()
                },
                b = !1,
                f = "none";
            d.current.addEventListener("touchstart", P => {
                P.preventDefault(), I(), M = {
                    x: -le(P).x,
                    y: -le(P).y
                }
            }), d.current.addEventListener("mousedown", P => {
                P.preventDefault(), b = !0, I(), M = {
                    x: -de(P).x,
                    y: -de(P).y
                }
            });
            const w = P => {
                if (c || p) {
                    const S = Ie(n === "velocity" ? T : se(d.current));
                    S !== f && (f = S, f === "none" ? p && p() : c && c(S))
                }
                const C = Ze(P, d.current, M, o);
                T = Ae(o, C), o = C
            };
            d.current.addEventListener("touchmove", P => {
                P.preventDefault(), w(le(P))
            }), d.current.addEventListener("mousemove", P => {
                P.preventDefault(), b && w(de(P))
            }), d.current.addEventListener("touchend", P => {
                P.preventDefault(), r(d.current, T)
            }), d.current.addEventListener("mouseup", P => {
                b && (P.preventDefault(), b = !1, r(d.current, T))
            }), d.current.addEventListener("mouseleave", P => {
                b && (P.preventDefault(), b = !1, r(d.current, T))
            })
        }, []), O.createElement("div", {
            ref: d,
            className: E
        }, s)
    });

function ge() {
    const {
        View: t
    } = g.useContext(G), [s, l] = t;
    return a("div", {
        className: "home-header",
        children: [e(Le, {
            onClick: () => l("profile")
        }), e("img", {
            className: "logo",
            src: "./assets/img/icons/tinder/logo.svg",
            onClick: () => l("home")
        }), e(_e, {
            onClick: () => l("messageList")
        })]
    })
}
const U = {
    account: {
        name: "James",
        bio: "I'm a cool guy",
        dob: 9624888e5,
        photos: ["https://r2.fivemanage.com/images/GRBUI6C4orbD.webp", "https://r2.fivemanage.com/images/98avzSwlgzsg.webp", "https://r2.fivemanage.com/images/rafgjPwSYnn2.png"],
        showMen: !1,
        showWomen: !0,
        isMale: !0,
        active: !0
    },
    accounts: [{
        number: "1",
        dob: 9653888e5,
        name: "Jessica",
        bio: "Swipe right if you like dogs",
        photos: ["https://r2.fivemanage.com/images/oRKcdeTA8oBy.png"],
        isMale: !1,
        matched: !0
    }, {
        number: "2",
        dob: 9653888e5,
        name: "Klara",
        bio: "Member of Lost MC, looking for a good time",
        photos: ["https://r2.fivemanage.com/images/787FMzhn5xD5.png", "https://r2.fivemanage.com/images/ZsmnyJOA2rc5.png"],
        isMale: !1,
        liked: !0
    }, {
        number: "3",
        dob: 9653888e5,
        name: "Steph",
        bio: "Evening strolls are my thing",
        photos: ["https://r2.fivemanage.com/images/7zj3Xgy6FsXK.png"],
        matched: !0,
        isMale: !1,
        lastMessage: "I'm perfect, you look good!"
    }],
    messages: {
        3: [{
            sender: "1",
            content: "Im perfect, you look good!",
            timestamp: Date.now() - 1e3 * 60 * 60 * 24 * 1
        }, {
            sender: "1234567890",
            content: "I'm good, how about you?",
            timestamp: Date.now() - 1e3 * 60 * 60 * 24 * 2
        }, {
            sender: "1",
            content: "Hey, how are you?",
            timestamp: Date.now() - 1e3 * 60 * 60 * 24 * 3
        }]
    }
};

function tt() {
    var ve;
    const {
        View: t,
        User: s,
        Account: l
    } = g.useContext(G), [u, E] = t, [y, n] = s, [v, c] = l, [p, h] = g.useState([]), [i, d] = g.useState(0), [r, I] = g.useState(), M = g.useRef(i), T = g.useRef(0), [o, b] = g.useState([]), [f, w] = g.useState(0), [P, C] = g.useState(!1), [S, D] = g.useState(null);
    let [_, R] = g.useState("");
    g.useEffect(() => {
        ne("Tinder") && x("Tinder", {
            action: "getFeed",
            page: 0
        }, U.accounts.filter(N => !N.matched)).then(N => {
            N && N.length > 0 ? (h(N), d(N.length - 1), T.current = N.length, b(Array(N.length).fill(0).map(A => O.createRef()))) : C(!0)
        })
    }, []);
    const V = N => {
            d(N), M.current = N
        },
        oe = i < p.length - 1,
        Ce = i >= 0,
        De = (N, A, L) => {
            I(N), V(L - 1), fe(), N === "right" ? x("Tinder", {
                action: "swipe",
                like: !0,
                number: A.number
            }, U.accounts.find(Q => Q.liked && Q.number == A.number)).then(Q => {
                Q && D(A)
            }) : N === "left" && x("Tinder", {
                action: "swipe",
                like: !1,
                number: A.number
            })
        },
        Re = (N, A) => {
            M.current >= A && o[A].current.restoreCard()
        },
        pe = async N => {
            Ce && i < p.length && (await o[i].current.swipe(N), fe())
        }, ke = async () => {
            var A, L;
            if (!oe) return;
            const N = i + 1;
            V(N), await ((L = (A = o[N]) == null ? void 0 : A.current) == null ? void 0 : L.restoreCard())
        }, fe = () => {
            if (T.current > 1) {
                T.current = T.current - 1;
                return
            }
            x("Tinder", {
                action: "getFeed",
                page: f + 1
            }).then(N => {
                if (N)
                    if (N && N.length > 0) {
                        w(f + 1);
                        let A = N.length + p.length;
                        h(L => (L = [...L, ...N], L)), T.current = N.length, d(A - 1), b(Array(A).fill(0).map(L => O.createRef()))
                    } else C(!0)
            })
        };
    return a("div", {
        className: `home-wrapper slide ${u=="profile"?"left":"right"}`,
        children: [e(ge, {}), e(we, {
            children: S && a(ye.div, {
                initial: {
                    opacity: 0,
                    scale: .1
                },
                animate: {
                    opacity: 1,
                    scale: 1
                },
                exit: {
                    opacity: 0,
                    scale: .1
                },
                transition: {
                    duration: .3,
                    ease: "easeInOut"
                },
                className: "match",
                style: {
                    backgroundImage: `url(${S.photos[0]})`
                },
                children: [e("img", {
                    className: "match-image",
                    src: "./assets/img/icons/tinder/match.png"
                }), a("div", {
                    className: "likes-too",
                    children: [S.name, " ", (ve = m("APPS.TINDER.LIKES_YOU_TOO")) == null ? void 0 : ve.toLowerCase()]
                }), a("div", {
                    className: "input",
                    children: [e(F, {
                        type: "text",
                        placeholder: m("APPS.TINDER.SAY_SOMETHING_NICE"),
                        onChange: N => R(N.target.value)
                    }), e("div", {
                        className: "send",
                        onClick: () => {
                            x("Tinder", {
                                action: "sendMessage",
                                data: {
                                    recipient: S.number,
                                    content: _
                                }
                            }, !0).then(N => {
                                N && (n(S), E("message"))
                            })
                        },
                        children: m("APPS.TINDER.SEND")
                    })]
                }), e("div", {
                    className: "keep-swiping",
                    onClick: () => D(null),
                    children: m("APPS.TINDER.KEEP_SWIPING")
                })]
            })
        }), a("div", {
            className: "home-body",
            children: [a("div", {
                className: "cards",
                children: [P && e("div", {
                    className: "card no-more",
                    children: e("div", {
                        children: m("APPS.TINDER.NO_MORE")
                    })
                }), !v.active && e("div", {
                    className: "card no-more",
                    children: e("div", {
                        children: m("APPS.TINDER.HIDDEN_PROFILE")
                    })
                }), v.active && p.map((N, A) => e(et, {
                    ref: o[A],
                    className: "swipe",
                    onSwipe: L => De(L, N, A),
                    onCardLeftScreen: () => Re(N, A),
                    children: e(st, {
                        user: N
                    })
                }, A))]
            }), a("div", {
                className: "actions",
                children: [e("div", {
                    className: "button",
                    onClick: () => pe("left"),
                    children: e(X, {
                        style: {
                            color: "#F24C65"
                        }
                    })
                }), e("div", {
                    className: `button small ${oe?"":"disabled"}`,
                    onClick: () => ke(),
                    children: e(Oe, {
                        style: {
                            rotate: "180deg",
                            color: "#F2B721"
                        }
                    })
                }), e("div", {
                    className: "button",
                    onClick: () => pe("right"),
                    children: e(Ve, {
                        style: {
                            color: "#3CDBA7"
                        }
                    })
                })]
            })]
        })]
    })
}
const st = t => {
    let s = t.user;
    const [l, u] = g.useState(0), [E, y] = g.useState(0);
    return g.useEffect(() => {
        y(q(s.dob))
    }, [s]), a("div", {
        className: "card",
        style: {
            backgroundImage: `url(${s.photos[l]})`
        },
        onClick: n => {
            l < s.photos.length - 1 ? u(l + 1) : u(0)
        },
        children: [s.photos.length > 1 && e("div", {
            className: "image-count",
            children: s.photos.map((n, v) => e("div", {
                className: `image ${v==l?"active":""}`,
                onClick: c => {
                    c.stopPropagation(), u(v)
                }
            }))
        }), a("div", {
            className: "card-content",
            children: [a("div", {
                className: "name",
                children: [s.name, " ", e("span", {
                    children: E
                })]
            }), e("div", {
                className: "description",
                children: s.bio
            })]
        })]
    })
};

function at() {
    var b;
    const {
        LoggedIn: t,
        Account: s
    } = g.useContext(G), l = z(B.PhoneNumber), [u, E] = s, [y, n] = t, [v, c] = g.useState("notLoggedIn"), [p, h] = g.useState(0), [i, d] = g.useState({});
    g.useEffect(() => {
        ne("Tinder") && (v == "notLoggedIn" ? B.Styles.TextColor.set("#ffffff") : B.Styles.TextColor.set("#000000"))
    }, [v]);
    const [r, I] = g.useState({
        name: null,
        photos: [],
        _dob: {
            day: "",
            month: "",
            year: ""
        },
        dob: null,
        bio: null,
        showMen: !1,
        showWomen: !1,
        isMale: null,
        active: !0
    }), M = f => {
        var w, P, C;
        switch (f) {
            case 0:
                let S = new Date(`${(w=r._dob)==null?void 0:w.year}/${(P=r._dob)==null?void 0:P.month}/${(C=r._dob)==null?void 0:C.day}`);
                if (T(S)) {
                    let D = q(S);
                    r.name && r.name.length >= 2 && D >= 18 && D <= 100 && (I({
                        ...r,
                        dob: S.getTime()
                    }), h(f + 1))
                }
                break;
            case 1:
                r.photos.length > 0 && h(f + 1);
                break;
            case 2:
                r.bio && r.bio.length >= 10 && h(f + 1);
                break;
            case 3:
                (r.showMen || r.showWomen) && h(f + 1);
                break;
            case 4:
                (r.isMale == !0 || r.isMale == !1) && x("Tinder", {
                    action: "createAccount",
                    data: {
                        ...r,
                        dob: new Date(r.dob).toISOString().split("T")[0]
                    }
                }, !0).then(D => {
                    if (!D) return J("error", "Failed to create account");
                    H.APPS.TINDER.account.set(r), E(r), n(!0)
                });
                break
        }
    }, T = f => f.getTime() === f.getTime();
    let o = [m("APPS.TINDER.CREATE_ACCOUNT"), m("APPS.TINDER.ADD_PHOTOS"), m("APPS.TINDER.DESCRIPTION"), m("APPS.TINDER.SHOW_ME"), m("APPS.TINDER.I_AM")];
    return e("div", {
        className: "login-container",
        style: {
            background: v === "notLoggedIn" ? "linear-gradient(45deg, #ff4573, #ff5f65)" : "#ffffff"
        },
        children: v === "notLoggedIn" ? a($, {
            children: [a("div", {
                className: "logo",
                children: [e("img", {
                    src: "./assets/img/icons/tinder/logo-white.svg"
                }), e("div", {
                    className: "logo-text",
                    children: (b = m("APPS.TINDER.TITLE")) == null ? void 0 : b.toLowerCase()
                })]
            }), a("div", {
                className: "buttons",
                children: [e("div", {
                    className: "disclamer",
                    children: m("APPS.TINDER.AGREE_TERMS")
                }), e("div", {
                    className: "button create",
                    onClick: () => c("createAccount"),
                    children: m("APPS.TINDER.CREATE_ACCOUNT")
                })]
            })]
        }) : a("div", {
            className: "create-account",
            children: [a("div", {
                className: "login-header",
                children: [e(Fe, {
                    onClick: () => {
                        p > 0 ? h(p - 1) : c("notLoggedIn")
                    }
                }), e("div", {
                    className: "title",
                    children: o[p]
                })]
            }), p == 0 && e($, {
                children: a("div", {
                    className: "form-body",
                    children: [e(F, {
                        defaultValue: Ue(l),
                        type: "text",
                        disabled: !0
                    }), e(F, {
                        placeholder: "Name",
                        type: "text",
                        maxLength: 25,
                        onChange: f => {
                            I({
                                ...r,
                                name: f.target.value
                            }), f.target.value.length >= 3 ? d({
                                ...i,
                                name: !0
                            }) : d({
                                ...i,
                                name: !1
                            })
                        }
                    }), a("div", {
                        className: "dob",
                        children: [a("div", {
                            className: "inputs",
                            children: [e(F, {
                                placeholder: "MM",
                                type: "text",
                                pattern: "/^-?\\d+\\.?\\d*$/",
                                minLength: 2,
                                maxLength: 2,
                                onChange: f => {
                                    I({
                                        ...r,
                                        _dob: {
                                            ...r._dob,
                                            month: f.target.value
                                        }
                                    })
                                }
                            }), e("span", {
                                children: "/"
                            }), e(F, {
                                placeholder: "DD",
                                type: "text",
                                pattern: "/^-?\\d+\\.?\\d*$/",
                                minLength: 2,
                                maxLength: 2,
                                onChange: f => {
                                    I({
                                        ...r,
                                        _dob: {
                                            ...r._dob,
                                            day: f.target.value
                                        }
                                    })
                                }
                            }), e("span", {
                                children: "/"
                            }), e(F, {
                                placeholder: "YYYY",
                                type: "text",
                                pattern: "/^-?\\d+\\.?\\d*$/",
                                minLength: 4,
                                maxLength: 4,
                                onChange: f => {
                                    var S, D, _;
                                    let w = {
                                        ...r,
                                        _dob: {
                                            ...r._dob,
                                            year: f.target.value
                                        }
                                    };
                                    I(w);
                                    let P = new Date(`${(S=w._dob)==null?void 0:S.year}/${(D=w._dob)==null?void 0:D.month}/${(_=w._dob)==null?void 0:_.day}`),
                                        C = q(P);
                                    C >= 18 && C < 100 ? d({
                                        ...i,
                                        18: !0
                                    }) : d({
                                        ...i,
                                        18: !1
                                    })
                                }
                            })]
                        }), e("div", {
                            className: "disclamer",
                            children: m("APPS.TINDER.AGE_PUBLIC")
                        }), a("div", {
                            className: "requirement",
                            children: [i[18] ? e(Z, {
                                className: "green"
                            }) : e(ee, {
                                className: "red"
                            }), m("APPS.TINDER.BE_OVER_18")]
                        }), a("div", {
                            className: "requirement",
                            children: [i.name ? e(Z, {
                                className: "green"
                            }) : e(ee, {
                                className: "red"
                            }), m("APPS.TINDER.NAME_MINIMUM")]
                        })]
                    })]
                })
            }), p == 1 && a($, {
                children: [e("div", {
                    className: "photo-grid",
                    children: [...Array(6)].map((f, w) => {
                        var C;
                        let P = ((C = r.photos) == null ? void 0 : C[w - 1]) || w == 0;
                        return r.photos[w] ? e("div", {
                            className: "photo",
                            style: {
                                backgroundImage: `url(${r.photos[w]})`
                            },
                            children: e("div", {
                                className: "button remove",
                                onClick: () => {
                                    let S = r.photos;
                                    S.splice(w, 1), I({
                                        ...r,
                                        photos: S
                                    }), S.length == 0 && d({
                                        ...i,
                                        photos: !1
                                    })
                                },
                                children: e(X, {})
                            })
                        }) : e("div", {
                            className: "photo",
                            children: P && e("div", {
                                className: "button add",
                                onClick: () => {
                                    var S, D, _;
                                    W.Gallery.set({
                                        allowExternal: (_ = (D = (S = te) == null ? void 0 : S.value) == null ? void 0 : D.AllowExternal) == null ? void 0 : _.Spark,
                                        onSelect: R => I({
                                            ...r,
                                            photos: [...r.photos, R.src]
                                        })
                                    }), d({
                                        ...i,
                                        photos: !0
                                    })
                                },
                                children: e(Se, {})
                            })
                        })
                    })
                }), a("div", {
                    className: "requirement",
                    children: [i.photos ? e(Z, {
                        className: "green"
                    }) : e(ee, {
                        className: "red"
                    }), m("APPS.TINDER.PHOTOS_MINIMUM")]
                })]
            }), p == 2 && a($, {
                children: [e(Me, {
                    placeholder: "Description",
                    maxLength: 200,
                    onChange: f => {
                        I({
                            ...r,
                            bio: f.target.value
                        }), f.target.value.length >= 10 ? d({
                            ...i,
                            bio: !0
                        }) : d({
                            ...i,
                            bio: !1
                        })
                    }
                }), a("div", {
                    className: "requirement",
                    children: [i.bio ? e(Z, {
                        className: "green"
                    }) : e(ee, {
                        className: "red"
                    }), m("APPS.TINDER.DESCRIPTION_MINIMUM")]
                })]
            }), p == 3 && e($, {
                children: a("div", {
                    className: "showme",
                    children: [e("div", {
                        className: `button border ${r.showWomen&&!r.showMen?"active":""}`,
                        onClick: () => {
                            I({
                                ...r,
                                showMen: !1,
                                showWomen: !0
                            })
                        },
                        children: m("APPS.TINDER.WOMEN")
                    }), e("div", {
                        className: `button border ${r.showMen&&!r.showWomen?"active":""}`,
                        onClick: () => {
                            I({
                                ...r,
                                showMen: !0,
                                showWomen: !1
                            })
                        },
                        children: m("APPS.TINDER.MEN")
                    }), e("div", {
                        className: `button border ${r.showMen&&r.showWomen?"active":""}`,
                        onClick: () => {
                            I({
                                ...r,
                                showMen: !0,
                                showWomen: !0
                            })
                        },
                        children: m("APPS.TINDER.EVERYONE")
                    })]
                })
            }), p == 4 && e($, {
                children: a("div", {
                    className: "showme",
                    children: [e("div", {
                        className: `button border ${r.isMale===!0?"active":""}`,
                        onClick: () => {
                            I({
                                ...r,
                                isMale: !0
                            })
                        },
                        children: m("APPS.TINDER.MALE")
                    }), e("div", {
                        className: `button border ${r.isMale===!1?"active":""}`,
                        onClick: () => {
                            I({
                                ...r,
                                isMale: !1
                            })
                        },
                        children: m("APPS.TINDER.FEMALE")
                    })]
                })
            }), e("div", {
                className: "button gradient",
                onClick: () => M(p),
                children: m("APPS.TINDER.CONTINUE")
            })]
        })
    })
}
const ae = $e(null);

function nt() {
    var T;
    const {
        View: t,
        User: s
    } = g.useContext(G);
    z(B.Settings);
    const l = z(B.PhoneNumber),
        [u, E] = s,
        [y, n] = t,
        v = z(ae),
        [c, p] = g.useState([]),
        h = g.useRef(null),
        i = g.useRef(0),
        [d, r] = g.useState({
            content: "",
            attachments: []
        });
    g.useEffect(() => {
        ne("Tinder") && x("Tinder", {
            action: "getMessages",
            page: 0,
            number: u.number
        }, U.messages[u.number]).then(o => {
            o && o.length > 0 ? p(o.reverse()) : setFetchedEverything(!0)
        })
    }, []);
    const I = () => {
            if (d.content.length === 0 && d.attachments.length === 0) return;
            const o = {
                sender: l,
                recipient: u.number,
                content: d.content,
                attachments: d.attachments,
                timestamp: new Date().getTime()
            };
            x("Tinder", {
                action: "sendMessage",
                data: o
            }, !0).then(b => {
                if (!b) return J("error", "Failed to send message");
                h.current.value = "", r({
                    content: "",
                    attachments: []
                }), p([...c, o])
            })
        },
        {
            handleScroll: M
        } = We({
            fetchData: o => x("Tinder", {
                action: "getMessages",
                number: u.number,
                page: o
            }),
            onDataFetched: o => {
                let b = document.querySelector(".message-container");
                i.current = b.scrollHeight, p([...o.reverse(), ...c])
            },
            isReversed: !0,
            perPage: 25
        });
    return g.useEffect(() => {
        let o = document.querySelector(".message-container");
        const b = o.scrollHeight;
        o.scrollTop += b - i.current, o.scroll
    }, [c]), Te("tinder:newMessage", o => {
        u.number === o.sender && p([...c, o])
    }), a("div", {
        className: "home-wrapper slide left",
        children: [e(we, {
            children: v && e(ot, {})
        }), a("div", {
            className: "message-header",
            children: [e(He, {
                onClick: () => {
                    n("messageList"), E(null)
                }
            }), a("div", {
                className: "user",
                onClick: () => ae.set(u),
                children: [e(Y, {
                    className: "profile-picture",
                    src: (T = u.photos) == null ? void 0 : T[0]
                }), e("div", {
                    className: "name",
                    children: u.name
                })]
            })]
        }), e("div", {
            className: "message-container",
            onScroll: M,
            children: e("div", {
                className: "message-body",
                children: c.map((o, b) => {
                    var C, S, D, _;
                    let f, w = o.sender === l ? "self" : "other",
                        P = ((C = c[b + 1]) == null ? void 0 : C.sender) === l ? "self" : "other";
                    return c[b + 1] ? f = Math.abs(o.timestamp - c[b + 1].timestamp) / 36e5 : P = void 0, a("div", {
                        className: `message ${w}`,
                        children: [w == "other" ? a("div", {
                            className: "message-with-pfp",
                            children: [e("div", {
                                className: `profile-picture ${w!==P?"show":"hide"}`,
                                children: e(Y, {
                                    src: (S = u.photos) == null ? void 0 : S[0]
                                })
                            }), a("div", {
                                className: "message-content",
                                children: [o.content && e("div", {
                                    className: "content",
                                    children: Ne(o.content)
                                }), ((D = o.attachments) == null ? void 0 : D.length) > 0 && e("div", {
                                    className: "attatchments",
                                    children: o.attachments.map((R, V) => re(R) ? e("video", {
                                        src: R,
                                        controls: !1,
                                        loop: !0,
                                        autoPlay: !0,
                                        muted: !0,
                                        onClick: oe => {
                                            W.FullscreenImage.set(R)
                                        }
                                    }, V) : e(Y, {
                                        src: R,
                                        blur: !0,
                                        onClick: () => {
                                            W.FullscreenImage.set(R)
                                        }
                                    }, V))
                                })]
                            })]
                        }) : a($, {
                            children: [o.content && e("div", {
                                className: "content",
                                children: Ne(o.content)
                            }), ((_ = o.attachments) == null ? void 0 : _.length) > 0 && e("div", {
                                className: "attatchments",
                                children: o.attachments.map((R, V) => re(R) ? e("video", {
                                    src: R,
                                    controls: !1,
                                    loop: !0,
                                    autoPlay: !0,
                                    muted: !0,
                                    onClick: () => {
                                        W.FullscreenImage.set(R)
                                    }
                                }, V) : e(Y, {
                                    src: R,
                                    onClick: () => {
                                        W.FullscreenImage.set(R)
                                    }
                                }, V))
                            })]
                        }), c[b + 1] && f > 6 ? e("div", {
                            className: "date",
                            children: be(o.timestamp)
                        }) : w !== P && e("div", {
                            className: "date",
                            children: be(o.timestamp)
                        })]
                    }, b)
                })
            })
        }), e("div", {
            className: "attachments",
            children: d.attachments.map((o, b) => a("div", {
                className: "attachment",
                children: [re(o) ? e("video", {
                    src: o,
                    controls: !1,
                    muted: !0,
                    loop: !0,
                    autoPlay: !0
                }) : e(Y, {
                    src: o
                }), e(X, {
                    onClick: () => {
                        r({
                            ...d,
                            attachments: d.attachments.filter((f, w) => w !== b)
                        })
                    }
                })]
            }))
        }), a("div", {
            className: "message-bottom",
            children: [e(Be, {
                className: "image",
                onClick: () => {
                    var o, b, f;
                    d.attachments.length < 3 && W.Gallery.set({
                        includeVideos: !0,
                        allowExternal: (f = (b = (o = te) == null ? void 0 : o.value) == null ? void 0 : b.AllowExternal) == null ? void 0 : f.Messages,
                        onSelect: w => r({
                            ...d,
                            attachments: [...d.attachments, w.src]
                        })
                    })
                }
            }), a("div", {
                className: "input",
                children: [e(F, {
                    type: "text",
                    placeholder: "Type a message...",
                    ref: h,
                    onChange: o => {
                        r({
                            ...d,
                            content: o.target.value
                        })
                    },
                    onKeyDown: o => {
                        o.key === "Enter" && I()
                    }
                }), e(Ge, {
                    className: d.attachments.length > 0 || d.content.length > 0 ? "active" : "",
                    onClick: () => I()
                })]
            })]
        })]
    })
}
const ot = () => {
    var u;
    const t = z(ae),
        [s, l] = g.useState(0);
    return t ? a(ye.div, {
        initial: {
            opacity: 0,
            y: 500
        },
        animate: {
            opacity: 1,
            y: 0
        },
        exit: {
            opacity: 0,
            y: 500
        },
        className: "popup-profile-container",
        children: [a("div", {
            className: "gallery",
            children: [e(Y, {
                src: (u = t == null ? void 0 : t.photos) == null ? void 0 : u[s],
                onClick: () => {
                    t && l(s < (t == null ? void 0 : t.photos.length) - 1 ? s + 1 : 0)
                }
            }), (t == null ? void 0 : t.photos.length) > 1 && e("div", {
                className: "image-count",
                children: t == null ? void 0 : t.photos.map((E, y) => e("div", {
                    className: Ye("image", y == s && "active"),
                    onClick: n => {
                        n.stopPropagation(), l(y)
                    }
                }))
            }), e("div", {
                className: "close",
                onClick: () => ae.set(null),
                children: e(X, {})
            })]
        }), a("div", {
            className: "card-content",
            children: [a("div", {
                className: "name",
                children: [t == null ? void 0 : t.name, ", ", e("span", {
                    children: q(t == null ? void 0 : t.dob)
                })]
            }), e("div", {
                className: "divider"
            }), a("div", {
                className: "description",
                children: [e("div", {
                    className: "title",
                    children: "About Me"
                }), t == null ? void 0 : t.bio]
            })]
        })]
    }) : null
};

function rt() {
    const {
        View: t,
        User: s
    } = g.useContext(G), [l, u] = s, [E, y] = t, [n, v] = g.useState({
        newMatches: [],
        messages: []
    });
    return g.useEffect(() => {
        ne("Tinder") && (B.Styles.TextColor.set("#000000"), x("Tinder", {
            action: "getMatches"
        }, {
            newMatches: U.accounts.filter(c => c.matched && !U.messages[c.number]),
            messages: U.accounts.filter(c => U.messages[c.number])
        }).then(c => {
            if (!c) return J("warning", "No response received from Tinder getMatches");
            v(c)
        }))
    }, []), Te("tinder:newMessage", c => {
        let p = c.sender,
            h = JSON.parse(JSON.stringify(n)),
            i = h.messages.findIndex(d => d.number === p);
        if (i !== -1) h.messages.unshift(h.messages.splice(i, 1)[0]);
        else if (i = h.newMatches.findIndex(d => d.number === p), i !== -1) h.messages.unshift(h.newMatches.splice(i, 1)[0]);
        else return;
        h.messages[0].lastMessage = c.content, v(h)
    }), a("div", {
        className: "home-wrapper slide left",
        children: [e(ge, {}), e(ze, {
            placeholder: m("APPS.TINDER.SEARCH_MATCHES"),
            onChange: () => {}
        }), " ", a("div", {
            className: "message-list-body",
            children: [a("div", {
                className: "new-matches",
                children: [a("div", {
                    className: "title",
                    children: [m("APPS.TINDER.NEW_MATCHES"), n.newMatches.length > 0 && e("span", {
                        children: n.newMatches.length
                    })]
                }), e("div", {
                    className: "matches",
                    children: n.newMatches.map((c, p) => {
                        var h;
                        return a("div", {
                            className: "new-match",
                            onClick: () => {
                                u(c), y("message")
                            },
                            children: [e(he, {
                                className: "profile-picture",
                                avatar: (h = c.photos) == null ? void 0 : h[0]
                            }), e("div", {
                                className: "name",
                                children: c.name
                            })]
                        }, p)
                    })
                })]
            }), a("div", {
                className: "recent-messages",
                children: [e("div", {
                    className: "title",
                    children: m("APPS.TINDER.MESSAGES")
                }), e("div", {
                    className: "messages",
                    children: n.messages.map((c, p) => {
                        var h, i;
                        return ((h = c.lastMessage) == null ? void 0 : h.length) === 0 && (c.lastMessage = m("APPS.MESSAGES.SENT_A_PHOTO")), a("div", {
                            className: "message",
                            onClick: () => {
                                u(c), y("message")
                            },
                            children: [e(he, {
                                className: "profile-picture",
                                avatar: (i = c.photos) == null ? void 0 : i[0]
                            }), a("div", {
                                className: "user",
                                children: [e("div", {
                                    className: "name",
                                    children: c.name
                                }), e("div", {
                                    className: "message",
                                    children: c.lastMessage.length > 40 ? c.lastMessage.substring(0, 40) + "..." : c.lastMessage
                                })]
                            })]
                        }, p)
                    })
                })]
            })]
        })]
    })
}

function it() {
    var c, p;
    const {
        Account: t,
        LoggedIn: s
    } = g.useContext(G), [l, u] = s, [E, y] = t, [n, v] = g.useState(E);
    return a("div", {
        className: "home-wrapper slide right",
        style: {
            backgroundColor: "#F6F6F6"
        },
        children: [e(ge, {}), a("div", {
            className: "profile-body",
            children: [a("div", {
                className: "user",
                children: [e(he, {
                    className: "profile-picture",
                    avatar: n.photos[0]
                }), a("div", {
                    className: "name",
                    children: [n.name, ", ", q(n.dob)]
                })]
            }), a("div", {
                className: "inputs",
                children: [a("div", {
                    className: "input",
                    children: [e("div", {
                        className: "label",
                        children: m("APPS.TINDER.NAME")
                    }), e(F, {
                        type: "text",
                        defaultValue: n.name,
                        maxLength: 10,
                        onChange: h => {
                            v({
                                ...n,
                                name: h.target.value
                            })
                        }
                    })]
                }), a("div", {
                    className: "input center",
                    children: [e("div", {
                        className: "label",
                        children: m("APPS.TINDER.PHOTOS")
                    }), e("div", {
                        className: "photo-grid",
                        children: [...Array(6)].map((h, i) => {
                            var r;
                            let d = ((r = n.photos) == null ? void 0 : r[i - 1]) || i == 0;
                            return n.photos[i] ? e("div", {
                                className: "photo",
                                style: {
                                    backgroundImage: `url(${n.photos[i]})`
                                },
                                children: e("div", {
                                    className: "photo-button remove",
                                    onClick: () => {
                                        let I = n.photos;
                                        I.splice(i, 1), v({
                                            ...n,
                                            photos: I
                                        })
                                    },
                                    children: e(X, {})
                                })
                            }, i) : e("div", {
                                className: "photo",
                                children: d && e("div", {
                                    className: "photo-button add",
                                    onClick: () => {
                                        var I, M, T;
                                        W.Gallery.set({
                                            allowExternal: (T = (M = (I = te) == null ? void 0 : I.value) == null ? void 0 : M.AllowExternal) == null ? void 0 : T.Spark,
                                            onSelect: o => v({
                                                ...n,
                                                photos: [...n.photos, o.src]
                                            })
                                        })
                                    },
                                    children: e(Se, {})
                                })
                            })
                        })
                    })]
                }), a("div", {
                    className: "input",
                    children: [e("div", {
                        className: "label",
                        children: m("APPS.TINDER.ABOUT_ME")
                    }), e(Me, {
                        type: "text",
                        defaultValue: n.bio,
                        maxLength: 100,
                        onChange: h => {
                            v({
                                ...n,
                                bio: h.target.value
                            })
                        }
                    })]
                }), a("div", {
                    className: "input",
                    children: [e("div", {
                        className: "label",
                        children: m("APPS.TINDER.INTERESTED_IN")
                    }), a("select", {
                        value: n.showMen && n.showWomen ? "Everyone" : n.showMen ? "Men" : "Women",
                        onChange: h => {
                            switch (h.target.value) {
                                case "Everyone":
                                    v({
                                        ...n,
                                        showMen: !0,
                                        showWomen: !0
                                    });
                                    break;
                                case "Men":
                                    v({
                                        ...n,
                                        showMen: !0,
                                        showWomen: !1
                                    });
                                    break;
                                case "Women":
                                    v({
                                        ...n,
                                        showMen: !1,
                                        showWomen: !0
                                    });
                                    break
                            }
                        },
                        children: [e("option", {
                            value: "Men",
                            children: m("APPS.TINDER.MEN")
                        }), e("option", {
                            value: "Women",
                            children: m("APPS.TINDER.WOMEN")
                        }), e("option", {
                            value: "Everyone",
                            children: m("APPS.TINDER.EVERYONE")
                        })]
                    })]
                }), a("div", {
                    className: "input",
                    children: [e("div", {
                        className: "label",
                        children: m("APPS.TINDER.GENDER")
                    }), a("select", {
                        value: n.isMale ? "male" : "female",
                        onChange: h => {
                            h.target.value == "male" ? v({
                                ...n,
                                isMale: !0
                            }) : v({
                                ...n,
                                isMale: !1
                            })
                        },
                        children: [e("option", {
                            value: "male",
                            children: m("APPS.TINDER.MALE")
                        }), e("option", {
                            value: "female",
                            children: m("APPS.TINDER.FEMALE")
                        })]
                    })]
                }), a("div", {
                    className: "input",
                    children: [e("div", {
                        className: "label",
                        children: m("APPS.TINDER.VISIBILITY")
                    }), a("select", {
                        value: n.active ? "visible" : "hidden",
                        onChange: h => {
                            let i = h.target.value;
                            v({
                                ...n,
                                active: i === "visible"
                            })
                        },
                        children: [e("option", {
                            value: "visible",
                            children: m("APPS.TINDER.VISIBLE")
                        }), e("option", {
                            value: "hidden",
                            children: m("APPS.TINDER.HIDDEN")
                        })]
                    }), !n.active && e("div", {
                        className: "warning",
                        children: m("APPS.TINDER.HIDDEN_WARNING")
                    })]
                })]
            }), ((p = (c = te) == null ? void 0 : c.value) == null ? void 0 : p.DeleteAccount.Spark) && e("div", {
                className: "button red",
                onClick: () => {
                    Ke("Tinder", () => {
                        y(null), u(!1)
                    }, !0)
                },
                children: m("APPS.TINDER.DELETE_ACCOUNT")
            }), e("div", {
                className: "button gradient",
                onClick: () => {
                    n.name.length >= 2 && n.bio.length >= 5 && n.photos.length >= 1 ? x("Tinder", {
                        action: "saveProfile",
                        data: n
                    }, !0).then(h => {
                        if (!h) return J("error", "Issue saving tinder profile");
                        H.APPS.TINDER.account.set(n), y(n)
                    }) : J("error", "Issue saving tinder profile, (name not 2 characters, bio not over 5 or no photos)")
                },
                children: m("APPS.TINDER.SAVE")
            })]
        })]
    })
}
const G = g.createContext(null);

function dt() {
    z(B.Settings);
    const [t, s] = g.useState(!1), [l, u] = g.useState(null), [E, y] = g.useState(null), [n, v] = g.useState("home"), [c, p] = g.useState(!0), h = {
        home: e(tt, {}),
        profile: e(it, {}),
        messageList: e(rt, {}),
        message: e(nt, {})
    };
    return g.useEffect(() => {
        if (H.APPS.TINDER.account.value) {
            u(H.APPS.TINDER.account.value), s(!0), p(!1);
            return
        } else if (H.APPS.TINDER.account.value === !1) return p(!1);
        x("Tinder", {
            action: "isLoggedIn"
        }, U.account).then(i => {
            i ? (u(i), s(!0), H.APPS.TINDER.account.set(i)) : H.APPS.TINDER.account.set(!1), p(!1)
        })
    }, []), g.useEffect(() => (n === "message" ? ie.ReceiveAppNotifications.set(!1) : ie.ReceiveAppNotifications.set(!0), () => {
        ie.ReceiveAppNotifications.set(!0)
    }), [n]), e("div", {
        className: "tinder-container",
        children: e(G.Provider, {
            value: {
                LoggedIn: [t, s],
                Account: [l, u],
                User: [E, y],
                View: [n, v]
            },
            children: c || !je() ? e("div", {
                className: "loading",
                children: e(Je, {
                    size: 40,
                    lineWeight: 5,
                    speed: 2,
                    color: "#000000"
                })
            }) : t ? h[n] : e(at, {})
        })
    })
}

function q(t) {
    var s = +new Date(t);
    return ~~((Date.now() - s) / 315576e5)
}
export {
    G as TinderContext, dt as
    default, q as getAge
};