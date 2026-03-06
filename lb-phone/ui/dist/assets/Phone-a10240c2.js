import {
    r as o,
    u as T,
    j as i,
    m as M,
    S as G,
    a as t,
    I as pe,
    L as a,
    F as R,
    C as _,
    b as ie,
    P as L,
    g as J,
    c as se,
    d as $,
    e as K,
    f as V,
    A as Q,
    h as he,
    i as z,
    k as de,
    l as Se,
    n as Te,
    o as be,
    p as ce,
    q as H,
    s as k,
    t as w,
    v as le,
    w as Ee,
    x as ge,
    y as Le,
    z as ye,
    B as fe,
    D as Ie,
    E as oe,
    G as me,
    H as He,
    J as ue,
    M as Pe,
    K as Ae,
    N as ke,
    O as _e,
    Q as we,
    R as Re,
    T as Me,
    U as De,
    V as Ue,
    W as Ve,
    X as xe,
    Y as $e,
    Z as Fe
} from "./index-99e0aeb1.js";

function Be() {
    var x, u, y, b;
    const {
        View: c,
        Contact: E
    } = o.useContext(q), s = T(L.Settings), C = T(L.PhoneNumber), [v, O] = o.useState(null), [d, A] = c, [e, r] = E, P = T(w.APPS.PHONE.contacts), [f, N] = o.useState(!1), [m, S] = o.useState(!1);
    o.useEffect(() => O(e.number), []);
    const h = () => {
            H("Phone", {
                action: "removeContact",
                number: e.number
            }, !0).then(l => {
                if (!l) return k("warning", "Failed to remove contact");
                w.APPS.PHONE.contacts.set(P.filter(n => n.number !== e.number)), r(null), A("Contacts")
            })
        },
        g = () => {
            H("Phone", {
                action: "toggleBlock",
                number: e.number,
                blocked: !e.blocked
            }, !0).then(l => {
                if (l === void 0) return k("warning", "Failed to toggle block");
                r({
                    ...e,
                    blocked: !e.blocked
                }), w.APPS.PHONE.contacts.set(P.map(n => n.number === e.number ? {
                    ...n,
                    blocked: !n.blocked
                } : n))
            })
        },
        I = () => {
            H("Phone", {
                action: "toggleFavourite",
                number: e.number,
                favourite: !e.favourite
            }, !0).then(l => {
                if (!l) return k("warning", "Failed to toggle favourite");
                r({
                    ...e,
                    favourite: !e.favourite
                }), w.APPS.PHONE.contacts.set(P.map(n => n.number === e.number ? {
                    ...n,
                    favourite: !n.favourite
                } : n))
            })
        },
        F = () => {
            if (!e.number || e.number.length === 0) return A("Contacts");
            e.number === C ? (L.Settings.patch({
                name: e.firstname,
                avatar: e.avatar ?? s.avatar,
                address: e.address,
                email: e.email
            }), H("setPhoneName", e.firstname), H("setSettings", L.Settings.value), N(l => !l), w.APPS.PHONE.contacts.set(P.map(l => l.number === e.number ? {
                ...l,
                ...e
            } : l))) : (e.lastname = e.lastname ?? "", H("Phone", {
                action: "updateContact",
                data: {
                    ...e,
                    oldNumber: v
                }
            }, !0).then(l => {
                if (!l) return k("warning", "Failed to update contact");
                w.APPS.PHONE.contacts.set(P.map(n => n.number === v ? {
                    ...n,
                    ...e
                } : n)), N(n => !n), O(e.number)
            }))
        },
        X = () => {
            e && _.PopUp.set({
                title: a("APPS.MESSAGES.SEND_LOCATION_POPUP.TITLE"),
                description: a("APPS.MESSAGES.SEND_LOCATION_POPUP.TEXT"),
                buttons: [{
                    title: a("APPS.MESSAGES.SEND_LOCATION_POPUP.CANCEL")
                }, {
                    title: a("APPS.MESSAGES.SEND_LOCATION_POPUP.SEND"),
                    cb: () => {
                        H("Maps", {
                            action: "getCurrentLocation"
                        }, {
                            x: "0",
                            y: "0"
                        }).then(l => {
                            l && H("Messages", {
                                action: "sendMessage",
                                number: e.number,
                                content: `<!SENT-LOCATION-X=${le(l.x,2)}Y=${le(l.y,2)}!>`,
                                attachments: []
                            }).then(n => {
                                if (!n) return k("warning", "something went wrong while sending location");
                                Q.patch({
                                    active: {
                                        name: "Messages",
                                        data: {
                                            number: e.number,
                                            name: e.firstname && K(e.firstname, e.lastname),
                                            avatar: e.avatar
                                        },
                                        view: "messages"
                                    }
                                })
                            })
                        })
                    }
                }]
            })
        },
        B = o.useRef(!0);
    return o.useEffect(() => {
        B.current && B.current && (O(e.number), B.current = !1, S(e.number === C))
    }, [e]), i(M.div, {
        ...G("right", "contact", .2),
        className: "animation-container",
        children: [t("div", {
            className: "contacts-header",
            children: i("div", {
                className: "items",
                children: [f ? t("span", {}) : i("div", {
                    className: "back",
                    onClick: () => {
                        A(e.from), r(null)
                    },
                    children: [t(pe, {}), a(`APPS.PHONE.${(x=e.from)==null?void 0:x.toUpperCase()}.TITLE`)]
                }), e.firstname && !e.company && t("span", {
                    onClick: () => {
                        f ? F() : N(l => !l)
                    },
                    children: f ? a("APPS.PHONE.DONE") : a("APPS.PHONE.EDIT")
                })]
            })
        }), t("div", {
            className: "content",
            children: f ? t(R, {
                children: i("div", {
                    className: "contact nohover",
                    children: [i("div", {
                        className: "user",
                        onClick: () => {
                            _.ContextMenu.set({
                                buttons: [{
                                    title: a("APPS.PHONE.CONTACTS.CHANGE_AVATAR"),
                                    cb: () => {
                                        var l, n, p;
                                        _.Gallery.set({
                                            allowExternal: (p = (n = (l = ie) == null ? void 0 : l.value) == null ? void 0 : n.AllowExternal) == null ? void 0 : p.Other,
                                            onSelect: Y => r({
                                                ...e,
                                                avatar: Y.src
                                            })
                                        })
                                    }
                                }, {
                                    title: a("APPS.PHONE.CONTACTS.REMOVE_AVATAR"),
                                    color: "red",
                                    cb: () => {
                                        r({
                                            ...e,
                                            avatar: null
                                        }), m && L.Settings.set({
                                            ...L.Settings.value,
                                            avatar: null
                                        })
                                    }
                                }]
                            })
                        },
                        children: [e.avatar || m && s.avatar ? t("div", {
                            className: "avatar bigger",
                            style: {
                                backgroundImage: `url(${e.avatar??s.avatar})`
                            }
                        }) : e.firstname ? t("div", {
                            className: "avatar bigger",
                            children: J(e.firstname, e.lastname)
                        }) : t(se, {}), t("span", {
                            children: a("APPS.PHONE.EDIT")
                        })]
                    }), i("div", {
                        className: "contact-info",
                        children: [t("div", {
                            className: "item input",
                            children: t($, {
                                type: "text",
                                placeholder: a("APPS.PHONE.CONTACTS.FIRST_NAME"),
                                value: e.firstname,
                                onChange: l => r({
                                    ...e,
                                    firstname: l.target.value
                                }),
                                maxLength: 20
                            })
                        }), !m && t("div", {
                            className: "item input",
                            children: t($, {
                                type: "text",
                                placeholder: a("APPS.PHONE.CONTACTS.LAST_NAME"),
                                value: e.lastname ?? "",
                                onChange: l => r({
                                    ...e,
                                    lastname: l.target.value
                                }),
                                maxLength: 20
                            })
                        })]
                    }), t("div", {
                        className: "contact-info",
                        children: t("div", {
                            className: "item input",
                            children: t($, {
                                className: "phone_number",
                                type: "number",
                                placeholder: a("APPS.PHONE.CONTACTS.PHONE_NUMBER"),
                                defaultValue: e == null ? void 0 : e.number,
                                maxLength: 20,
                                disabled: m,
                                onChange: l => {
                                    if (m) return;
                                    let n = l.target.value.slice(-1).charCodeAt(0);
                                    n >= 48 && n <= 57 && l.target.value.length <= 10 && r({
                                        ...e,
                                        number: l.target.value
                                    })
                                }
                            })
                        })
                    }), i("div", {
                        className: "contact-info",
                        children: [t("div", {
                            className: "item input",
                            children: t($, {
                                className: "phone_number",
                                type: "email",
                                placeholder: a("APPS.PHONE.CONTACTS.EMAIL"),
                                defaultValue: m ? s == null ? void 0 : s.email : e == null ? void 0 : e.email,
                                maxLength: 20,
                                onChange: l => {
                                    l.target.value.match(/^([\w.%+-]+)@([\w-]+\.)+([\w]{2,})$/i) && (m ? L.Settings.set({
                                        ...L.Settings.value,
                                        email: l.target.value
                                    }) : r({
                                        ...e,
                                        email: l.target.value
                                    }))
                                }
                            })
                        }), t("div", {
                            className: "item input",
                            children: t($, {
                                type: "text",
                                placeholder: a("APPS.PHONE.CONTACTS.ADDRESS"),
                                defaultValue: m ? s == null ? void 0 : s.address : e == null ? void 0 : e.address,
                                maxLength: 20,
                                onChange: l => {
                                    m ? L.Settings.set({
                                        ...L.Settings.value,
                                        address: l.target.value
                                    }) : r({
                                        ...e,
                                        address: l.target.value
                                    })
                                }
                            })
                        })]
                    }), !m && t("div", {
                        className: "contact-info",
                        children: t("div", {
                            className: "item red",
                            onClick: () => {
                                _.PopUp.set({
                                    title: a("APPS.PHONE.CONTACTS.REMOVE_CONTACT_TITLE"),
                                    description: a("APPS.PHONE.CONTACTS.REMOVE_CONTACT_TEXT"),
                                    buttons: [{
                                        title: a("APPS.PHONE.CONTACTS.REMOVE_CONTACT_BUTTON_CANCEL")
                                    }, {
                                        title: a("APPS.PHONE.CONTACTS.REMOVE_CONTACT_BUTTON_DELETE"),
                                        color: "red",
                                        cb: h
                                    }]
                                })
                            },
                            children: a("APPS.PHONE.CONTACTS.DELETE_CONTACT")
                        })
                    })]
                })
            }) : t(R, {
                children: i("div", {
                    className: "contact nohover details",
                    children: [i("div", {
                        className: "user",
                        children: [e.avatar || m && s.avatar ? t("div", {
                            className: "avatar bigger",
                            style: {
                                backgroundImage: `url(${m?s.avatar:e.avatar})`
                            }
                        }) : e.firstname ? t("div", {
                            className: "avatar bigger",
                            children: J(e.firstname, e.lastname)
                        }) : t(se, {}), t("div", {
                            className: "name",
                            children: e.firstname ? K(e.firstname, e.lastname) : V(e.number) ?? a("APPS.PHONE.CALL.NO_CALLER_ID")
                        })]
                    }), i("div", {
                        className: "actions",
                        children: [i("div", {
                            className: "item",
                            "data-disabled": m || e.company ? !0 : !e.number,
                            onClick: () => {
                                m || e.company || !e.number || Q.patch({
                                    active: {
                                        name: "Messages",
                                        data: {
                                            number: e.number,
                                            name: e.firstname && K(e.firstname, e.lastname),
                                            avatar: e.avatar,
                                            view: "messages"
                                        }
                                    }
                                })
                            },
                            children: [t(he, {}), a("APPS.PHONE.CONTACTS.MESSAGE")]
                        }), i("div", {
                            className: "item call",
                            "data-disabled": m || !e.number,
                            onClick: () => {
                                m || !e.number || z({
                                    number: e.number,
                                    company: e.company,
                                    companylabel: e.company && e.firstname
                                })
                            },
                            children: [t(de, {}), a("APPS.PHONE.CONTACTS.CALL")]
                        }), i("div", {
                            className: "item",
                            "data-disabled": m || e.company ? !0 : !e.number,
                            onClick: () => {
                                m || e.company || !e.number || z({
                                    number: e.number,
                                    company: e.company,
                                    companylabel: e.company && e.firstname,
                                    videoCall: !0
                                })
                            },
                            children: [t(Se, {}), a("APPS.PHONE.CONTACTS.VIDEO")]
                        }), i("div", {
                            className: "item",
                            "data-disabled": e.company ? !0 : !e.number,
                            onClick: () => {
                                e.company || !e.number || _.Share.set({
                                    type: "contact",
                                    data: {
                                        number: e.number,
                                        firstname: e.firstname,
                                        lastname: e.lastname,
                                        avatar: e.avatar || m && s.avatar,
                                        email: e.email,
                                        address: e.address
                                    }
                                })
                            },
                            children: [t(Te, {}), a("APPS.PHONE.CONTACTS.SHARE")]
                        })]
                    }), e.callData && t("div", {
                        className: "contact-info",
                        children: i("div", {
                            className: "item",
                            children: [t("div", {
                                className: "title",
                                children: Ke((u = e.callData) == null ? void 0 : u.timestamp)
                            }), t("div", {
                                className: "value calls",
                                children: e.callData.calls.map((l, n) => i("div", {
                                    className: "call-item",
                                    children: [t("div", {
                                        className: "timestamp",
                                        children: be(l.timestamp)
                                    }), i("div", {
                                        className: "call-content",
                                        children: [t("div", {
                                            className: "type",
                                            children: l.type
                                        }), l.responded && l.duration && t("div", {
                                            className: "call-duration",
                                            children: Ge(l.duration)
                                        })]
                                    })]
                                }, n))
                            })]
                        })
                    }), !e.company && e.number && i(R, {
                        children: [t("div", {
                            className: "contact-info",
                            children: i("div", {
                                className: "item",
                                onClick: () => {
                                    ce(e.number), _.PopUp.set({
                                        title: a("COMPONENTS.SHARE.COPY_POPUP.TITLE"),
                                        description: a("COMPONENTS.SHARE.COPY_POPUP.DESCRIPTION"),
                                        buttons: [{
                                            title: a("COMPONENTS.SHARE.COPY_POPUP.OK")
                                        }]
                                    })
                                },
                                children: [t("div", {
                                    className: "title",
                                    children: "phone"
                                }), t("div", {
                                    className: "value",
                                    children: V(e.number)
                                })]
                            })
                        }), (e.email || e.address) && i("div", {
                            className: "contact-info",
                            children: [e.email && i("div", {
                                className: "item",
                                onClick: () => ce(e.email),
                                children: [t("div", {
                                    className: "title",
                                    children: (y = a("APPS.PHONE.CONTACTS.EMAIL")) == null ? void 0 : y.toLowerCase()
                                }), t("div", {
                                    className: "value",
                                    children: e.email
                                })]
                            }), e.address && i("div", {
                                className: "item",
                                onClick: () => ce(e.address),
                                children: [t("div", {
                                    className: "title",
                                    children: (b = a("APPS.PHONE.CONTACTS.ADDRESS")) == null ? void 0 : b.toLowerCase()
                                }), t("div", {
                                    className: "value",
                                    children: e.address
                                })]
                            })]
                        }), t("div", {
                            className: "contact-info",
                            children: e.firstname ? t(R, {
                                children: !m && i(R, {
                                    children: [t("div", {
                                        className: "item",
                                        onClick: () => X(),
                                        children: a("APPS.PHONE.CONTACTS.SHARE_LOCATION")
                                    }), e.favourite ? t("div", {
                                        className: "item red",
                                        onClick: () => I(),
                                        children: a("APPS.PHONE.CONTACTS.REMOVE_FAVORITE")
                                    }) : t("div", {
                                        className: "item",
                                        onClick: () => I(),
                                        children: a("APPS.PHONE.CONTACTS.ADD_FAVORITE")
                                    }), e.blocked ? t("div", {
                                        className: "item red",
                                        onClick: () => {
                                            _.PopUp.set({
                                                title: a("APPS.PHONE.CONTACTS.UNBLOCK_NUMBER_TITLE"),
                                                description: a("APPS.PHONE.CONTACTS.UNBLOCK_NUMBER_TEXT").format({
                                                    number: V(e.number)
                                                }),
                                                buttons: [{
                                                    title: a("APPS.PHONE.CONTACTS.UNBLOCK_NUMBER_BUTTON_CANCEL")
                                                }, {
                                                    title: a("APPS.PHONE.CONTACTS.UNBLOCK_NUMBER_BUTTON_UNBLOCK"),
                                                    cb: () => g()
                                                }]
                                            })
                                        },
                                        children: a("APPS.PHONE.CONTACTS.UNBLOCK_CALLER")
                                    }) : t("div", {
                                        className: "item red",
                                        onClick: () => {
                                            _.PopUp.set({
                                                title: a("APPS.PHONE.CONTACTS.BLOCK_NUMBER_TITLE"),
                                                description: a("APPS.PHONE.CONTACTS.BLOCK_NUMBER_TEXT").format({
                                                    number: V(e.number)
                                                }),
                                                buttons: [{
                                                    title: a("APPS.PHONE.CONTACTS.BLOCK_NUMBER_BUTTON_CANCEL")
                                                }, {
                                                    title: a("APPS.PHONE.CONTACTS.BLOCK_NUMBER_BUTTON_BLOCK"),
                                                    color: "red",
                                                    cb: () => {
                                                        g()
                                                    }
                                                }]
                                            })
                                        },
                                        children: a("APPS.PHONE.CONTACTS.BLOCK_CALLER")
                                    })]
                                })
                            }) : t("div", {
                                className: "item",
                                onClick: () => A("NewContact"),
                                children: a("APPS.PHONE.CONTACTS.ADD_CONTACT")
                            })
                        })]
                    })]
                })
            })
        })]
    })
}
const Ke = c => new Date(c).toLocaleDateString(ie.value.DateLocale, {
        day: "numeric",
        month: "short",
        year: "numeric"
    }),
    Ge = c => c < 60 ? `${c} ${a("SECONDS")}` : c < 3600 ? `${Math.floor(c/60)} ${a("MINUTES")}` : `${Math.floor(c/3600)} ${a("HOURS")}`;

function Xe() {
    const {
        View: c,
        viewContact: E
    } = o.useContext(q), s = T(L.Settings), [C, v] = c, O = T(L.PhoneNumber), d = T(w.APPS.PHONE.contacts), [A, e] = o.useState("");
    return i(M.div, {
        ...G("left", "contacts", .2),
        className: "animation-container",
        children: [i("div", {
            className: "contacts-header",
            children: [i("div", {
                className: "items",
                children: [t("div", {
                    className: "title",
                    children: a("APPS.PHONE.CONTACTS.TITLE")
                }), t(Ee, {
                    onClick: () => v("NewContact")
                })]
            }), t(ge, {
                placeholder: a("SEARCH"),
                onChange: r => e(r.target.value)
            })]
        }), t("div", {
            className: "content",
            children: i("div", {
                className: "contact-list",
                children: [t("div", {
                    className: "letters",
                    children: [...Array(26)].map((r, P) => {
                        let f = String.fromCharCode(P + 65);
                        return t("a", {
                            children: f
                        }, P)
                    })
                }), t("div", {
                    className: "contact card",
                    onClick: () => E({
                        firstname: s == null ? void 0 : s.name,
                        number: O
                    }, "Contacts"),
                    children: i("div", {
                        className: "profile",
                        children: [s.avatar ? t("div", {
                            className: "avatar",
                            style: {
                                backgroundImage: `url(${s.avatar})`
                            }
                        }) : t("div", {
                            className: "avatar",
                            children: J(s == null ? void 0 : s.name)
                        }), i("div", {
                            className: "profile-info",
                            children: [t("div", {
                                className: "name",
                                children: s == null ? void 0 : s.name
                            }), t("div", {
                                className: "info",
                                children: a("APPS.PHONE.CONTACTS.MY_CARD")
                            })]
                        }), t(Le, {})]
                    })
                }), d && i(R, {
                    children: [Object.entries(d.filter(r => {
                        var P;
                        return (P = K(r.firstname, r.lastname)) == null ? void 0 : P.toLowerCase().includes(A == null ? void 0 : A.toLowerCase())
                    }).sort((r, P) => r.firstname.localeCompare(P.firstname)).reduce((r, P) => {
                        let f = P.firstname.charAt(0).toUpperCase();
                        return r[f] || (r[f] = []), r[f].push(P), r
                    }, {})).map(([r, P], f) => i("div", {
                        children: [t("div", {
                            id: r,
                            className: `divider ${f===0?"no-border":""}`,
                            children: r
                        }), t(M.div, {
                            initial: {
                                opacity: 0,
                                scale: .9
                            },
                            whileInView: {
                                opacity: 1,
                                scale: 1
                            },
                            viewport: {
                                once: !0
                            },
                            className: "contacts",
                            children: P.map((N, m) => i("div", {
                                className: "contact item border",
                                onClick: () => E(N, "Contacts"),
                                children: [N.avatar ? t("div", {
                                    className: "avatar",
                                    style: {
                                        backgroundImage: `url(${N.avatar})`
                                    }
                                }) : t("div", {
                                    className: "avatar",
                                    children: J(N.firstname, N.lastname)
                                }), i("div", {
                                    className: "details",
                                    children: [t("div", {
                                        className: "name",
                                        children: K(N.firstname, N.lastname)
                                    }), t("div", {
                                        className: "phone-number",
                                        children: V(N.number)
                                    })]
                                })]
                            }, m))
                        })]
                    }, f)), i("div", {
                        className: "total-contacts",
                        children: [d.length, " ", a("APPS.PHONE.CONTACTS.TITLE")]
                    })]
                })]
            })
        })]
    })
}

function Ye() {
    const {
        viewContact: c
    } = o.useContext(q), E = T(w.APPS.PHONE.contacts), [s, C] = o.useState(!1);
    return i(M.div, {
        ...G("left", "favourites", .2),
        className: "animation-container",
        children: [t("div", {
            className: "contacts-header",
            children: i("div", {
                className: "items",
                children: [t("div", {
                    className: "title",
                    children: a("APPS.PHONE.FAVOURITES.TITLE")
                }), t("span", {
                    onClick: () => C(!s),
                    children: s ? a("APPS.PHONE.DONE") : a("APPS.PHONE.EDIT")
                })]
            })
        }), t("div", {
            className: "content",
            children: t("div", {
                className: "favourite",
                children: E.filter(v => v.favourite || v.company).sort((v, O) => v.company ? -1 : 1).map((v, O) => {
                    let d = K(v.firstname, v.lastname);
                    return i(M.div, {
                        initial: {
                            opacity: 0,
                            scale: .9
                        },
                        whileInView: {
                            opacity: 1,
                            scale: 1
                        },
                        viewport: {
                            once: !0
                        },
                        className: "item",
                        onClick: () => {
                            _.PopUp.set({
                                title: a("APPS.PHONE.CALL.CALL_TITLE").format({
                                    name: d
                                }),
                                description: a("APPS.PHONE.CALL.CALL_TEXT").format({
                                    name: d
                                }),
                                buttons: [{
                                    title: a("APPS.PHONE.CALL.CALL_BUTTON_CANCEL")
                                }, {
                                    title: a("APPS.PHONE.CALL.CALL_BUTTON_CALL"),
                                    cb: () => {
                                        z({
                                            number: v.number,
                                            company: v.company,
                                            companylabel: v.firstname
                                        })
                                    }
                                }]
                            })
                        },
                        children: [i("div", {
                            className: "user",
                            children: [s && !v.company && t(ye, {
                                onClick: A => {
                                    A.stopPropagation(), _.PopUp.set({
                                        title: a("APPS.PHONE.FAVOURITES.REMOVE_TITLE"),
                                        description: a("APPS.PHONE.FAVOURITES.REMOVE_TEXT"),
                                        buttons: [{
                                            title: a("APPS.PHONE.FAVOURITES.REMOVE_BUTTON_CANCEL")
                                        }, {
                                            title: a("APPS.PHONE.FAVOURITES.REMOVE_BUTTON_REMOVE"),
                                            color: "red",
                                            cb: () => {
                                                H("Phone", {
                                                    action: "toggleFavourite",
                                                    number: v.number,
                                                    favourite: !1
                                                }, !0).then(e => {
                                                    if (!e) return k("warning", "Failed to remove favourite");
                                                    w.APPS.PHONE.contacts.set(E.map(r => r.number === v.number ? {
                                                        ...r,
                                                        favourite: !r.favourite
                                                    } : r))
                                                })
                                            }
                                        }]
                                    })
                                }
                            }), v.avatar ? t("div", {
                                className: "avatar",
                                style: {
                                    backgroundImage: `url(${v.avatar})`
                                }
                            }) : t("div", {
                                className: "avatar",
                                children: J(v.firstname, v.lastname)
                            }), i("div", {
                                className: "info",
                                children: [d, t("span", {
                                    children: V(v.number)
                                })]
                            })]
                        }), t(fe, {
                            onClick: A => {
                                A.stopPropagation(), c(v, "Favourites")
                            }
                        })]
                    }, O)
                })
            })
        })]
    })
}
const D = [697, 770, 852, 941],
    U = [1209, 1336, 1477, 1633],
    ve = {
        1: [D[0], U[0]],
        2: [D[0], U[1]],
        3: [D[0], U[2]],
        4: [D[1], U[0]],
        5: [D[1], U[1]],
        6: [D[1], U[2]],
        7: [D[2], U[0]],
        8: [D[2], U[1]],
        9: [D[2], U[2]],
        "*": [D[3], U[0]],
        0: [D[3], U[1]],
        "#": [D[3], U[2]]
    },
    je = [{
        key: "1",
        letters: ""
    }, {
        key: "2",
        letters: "ABC"
    }, {
        key: "3",
        letters: "DEF"
    }, {
        key: "4",
        letters: "GHI"
    }, {
        key: "5",
        letters: "JKL"
    }, {
        key: "6",
        letters: "MNO"
    }, {
        key: "7",
        letters: "PQRS"
    }, {
        key: "8",
        letters: "TUV"
    }, {
        key: "9",
        letters: "WXYZ"
    }, {
        key: "*",
        letters: ""
    }, {
        key: "0",
        letters: "+"
    }, {
        key: "#",
        letters: ""
    }],
    ae = {
        0: 2.5,
        12: 2,
        17: 1.75
    };

function ze() {
    const c = T(L.Settings),
        E = T(L.CallData),
        s = T(Q),
        {
            View: C,
            Contact: v,
            viewContact: O
        } = o.useContext(q),
        [d, A] = C,
        [e, r] = v,
        [P, f] = o.useState(null),
        [N, m] = o.useState(""),
        S = o.useRef(null),
        h = o.useRef([]),
        g = o.useRef(null),
        I = o.useRef(null),
        F = o.useRef(!0),
        [X, B] = o.useState(2.5);
    o.useEffect(() => {
        var n;
        if (!S.current && ((n = s == null ? void 0 : s.active) == null ? void 0 : n.name) === "Phone") return S.current = new AudioContext, () => {
            S.current && (u(), S.current.close(), S.current = null)
        }
    }, [s == null ? void 0 : s.active]), o.useEffect(() => {
        var n;
        F.current = !!(((n = s == null ? void 0 : s.active) == null ? void 0 : n.name) === "Phone" && (!E || E != null && E.banner))
    }, [s == null ? void 0 : s.active, E]), o.useEffect(() => {
        document.addEventListener("keydown", b), document.addEventListener("keyup", l), N === "0" && B(2.5);
        let n = 0;
        for (let p = 0; p < Object.keys(ae).length; p++) N.length >= parseInt(Object.keys(ae)[p]) && (n = ae[Object.keys(ae)[p]]);
        return B(n), () => {
            document.removeEventListener("keydown", b), document.removeEventListener("keyup", l)
        }
    }, [N]);
    const x = n => {
            var Ne;
            if (!S.current) return;
            const p = S.current,
                [Y, j] = ve[n],
                re = "sine",
                Z = p.createOscillator();
            Z.frequency.value = Y, Z.type = re;
            const ee = p.createOscillator();
            ee.frequency.value = j, ee.type = re;
            const te = p.createGain();
            te.gain.value = .2 * (((Ne = c == null ? void 0 : c.sound) == null ? void 0 : Ne.volume) !== void 0 ? c.sound.volume : .5), Z.connect(te), ee.connect(te), te.connect(p.destination), Z.start(), ee.start();
            const Oe = setTimeout(() => {
                u()
            }, 1500);
            h.current.push([Z, ee, te, Oe])
        },
        u = () => {
            h.current.forEach(([n, p, Y, j]) => {
                clearTimeout(j), S.current && (n.stop(), p.stop(), n.disconnect(), p.disconnect(), Y.disconnect())
            }), g.current = null, h.current = []
        },
        y = n => {
            F.current && (n == "delete" ? m(p => p.slice(0, -1)) : n.match(/^[0-9]+$/) && m(p => p + n), ve[n] && (g.current && u(), g.current = n, x(n)))
        },
        b = n => {
            g.current || n.repeat || (n.key.match(/^[0-9]+$/) ? (g.current = n.key, y(n.key)) : n.key === "Backspace" ? y("delete") : n.key === "Enter" && N.length >= 3 && z({
                number: N
            }))
        },
        l = n => {
            n.key === g.current && u()
        };
    return o.useEffect(() => {
        if (N.length !== Ie()) return f(null);
        f(oe(N))
    }, [N]), i(M.div, {
        ...G("left", "keypad", .2),
        className: "animation-container",
        children: [t("div", {
            className: "contacts-header",
            children: i("div", {
                className: "items",
                children: [t("div", {
                    className: "title",
                    children: a("APPS.PHONE.KEYPAD.TITLE")
                }), t(Ee, {
                    onClick: () => {
                        if (m(""), P) O(P, "Keypad");
                        else {
                            let n = oe(N);
                            n ? (r({
                                ...n,
                                number: N
                            }), A("NewContact")) : (r({
                                number: N
                            }), A("NewContact"))
                        }
                    }
                })]
            })
        }), t("div", {
            className: "content noscroll",
            children: i("div", {
                className: "keypad-container",
                children: [t("div", {
                    className: "inputbox",
                    children: t("div", {
                        className: "input",
                        style: {
                            fontSize: `${X}rem`
                        },
                        children: V(N)
                    })
                }), t("div", {
                    className: "keypad-wrapper",
                    children: i("div", {
                        className: "keypad",
                        children: [je.map(n => i("div", {
                            onMouseDown: () => y(n.key),
                            onMouseUp: () => u(),
                            children: [n.key, n.letters && t("span", {
                                children: n.letters
                            })]
                        }, n.key)), t("span", {}), t("div", {
                            className: "call",
                            onClick: () => {
                                N.length >= 3 && z({
                                    number: N
                                })
                            },
                            children: t(de, {})
                        }), t("div", {
                            className: "delete",
                            onMouseDown: () => {
                                if (!me("Phone")) return;
                                y("delete"), I.current && clearInterval(I.current);
                                const n = setInterval(() => {
                                    y("delete")
                                }, 100);
                                I.current = n
                            },
                            onMouseUp: () => {
                                I.current && (clearInterval(I.current), I.current = null)
                            },
                            children: t(He, {})
                        })]
                    })
                })]
            })
        })]
    })
}

function qe() {
    const {
        View: c,
        Contact: E
    } = o.useContext(q), s = T(L.PhoneNumber), [C] = E, [v, O] = c, d = T(w.APPS.PHONE.contacts), A = T(L.Settings), [e, r] = o.useState(null), [P, f] = o.useState(!1);
    o.useEffect(() => {
        L.Styles.TextColor.set(A.display.theme == "dark" ? "#ffffff" : "#000000")
    }, []), o.useEffect(() => {
        C && C.number && r({
            ...e,
            number: C.number
        })
    }, [C]), o.useEffect(() => {
        e && f(e.firstname && e.number !== void 0)
    }, [e]);
    const N = () => {
        if (e) {
            if (!e.number || (e == null ? void 0 : e.number) === s) return O("Contacts");
            e.lastname = (e == null ? void 0 : e.lastname) ?? "", H("Phone", {
                action: "saveContact",
                data: e
            }, !0).then(m => {
                if (!m) return k("warning", "Failed to save contact");
                w.APPS.PHONE.contacts.set([...d, e]), O("Contacts")
            })
        }
    };
    return i(M.div, {
        ...G("up", "newcontact", .2),
        className: "animation-container",
        children: [t("div", {
            className: "contacts-header",
            children: i("div", {
                className: "items",
                children: [t("div", {
                    className: "back",
                    onClick: () => O("Contacts"),
                    children: a("APPS.PHONE.CANCEL")
                }), t("span", {
                    className: P ? "" : "disabled",
                    onClick: () => {
                        P && N()
                    },
                    children: a("APPS.PHONE.DONE")
                })]
            })
        }), t("div", {
            className: "content",
            children: t(R, {
                children: i("div", {
                    className: "contact nohover",
                    children: [t("div", {
                        className: "user",
                        onClick: () => {
                            var m, S, h;
                            _.Gallery.set({
                                allowExternal: (h = (S = (m = ie) == null ? void 0 : m.value) == null ? void 0 : S.AllowExternal) == null ? void 0 : h.Other,
                                onSelect: g => r({
                                    ...e,
                                    avatar: g.src
                                })
                            })
                        },
                        children: e != null && e.avatar ? i(R, {
                            children: [t("div", {
                                className: "profile-image bigger transparent",
                                style: {
                                    backgroundImage: `url(${e.avatar})`
                                }
                            }), t("span", {
                                children: a("APPS.PHONE.EDIT")
                            })]
                        }) : i(R, {
                            children: [t(se, {
                                className: "big"
                            }), t("span", {
                                className: "add",
                                children: a("APPS.PHONE.CONTACTS.ADD_PHOTO")
                            })]
                        })
                    }), i("div", {
                        className: "contact-info",
                        children: [t("div", {
                            className: "item input",
                            children: t($, {
                                type: "text",
                                placeholder: a("APPS.PHONE.CONTACTS.FIRST_NAME"),
                                onChange: m => r({
                                    ...e,
                                    firstname: m.target.value
                                }),
                                maxLength: 20
                            })
                        }), t("div", {
                            className: "item input",
                            children: t($, {
                                type: "text",
                                placeholder: a("APPS.PHONE.CONTACTS.LAST_NAME"),
                                onChange: m => r({
                                    ...e,
                                    lastname: m.target.value
                                }),
                                maxLength: 20
                            })
                        })]
                    }), t("div", {
                        className: "contact-info",
                        children: t("div", {
                            className: "item input",
                            children: t($, {
                                className: "phone_number",
                                type: "number",
                                placeholder: a("APPS.PHONE.CONTACTS.PHONE_NUMBER"),
                                defaultValue: C == null ? void 0 : C.number,
                                maxLength: 15,
                                onChange: m => {
                                    let S = m.target.value.slice(-1).charCodeAt(0);
                                    S >= 48 && S <= 57 && r({
                                        ...e,
                                        number: m.target.value
                                    })
                                }
                            })
                        })
                    })]
                })
            })
        })]
    })
}
const ne = ue([]).mock(Pe.RecentCalls);

function We() {
    const {
        viewContact: c
    } = o.useContext(q), [E, s] = o.useState("all"), C = T(ne), v = ["all", "missed"];
    o.useEffect(() => {
        H("Phone", {
            action: "getRecent",
            page: 0,
            missed: E === "missed"
        }, Pe.RecentCalls.filter(d => E === "missed" ? !d.answered : !0)).then(d => {
            if (!d) return k("error", "Failed to get recent calls");
            ne.set(d)
        })
    }, [E]);
    const {
        handleScroll: O
    } = Ae({
        fetchData: d => H("Phone", {
            action: "getRecent",
            missed: E === "missed",
            page: d
        }),
        onDataFetched: d => ne.set([...ne.value, ...d]),
        perPage: 25
    });
    return i(M.div, {
        ...G("left", "recent", .2),
        className: "animation-container",
        children: [t("div", {
            className: "contacts-header",
            children: i("div", {
                className: "items col",
                children: [t("div", {
                    className: "selector-container",
                    children: t("div", {
                        className: "selector",
                        children: v.map((d, A) => t("div", {
                            className: "option",
                            "data-active": E === d,
                            onClick: () => s(d),
                            children: a(`APPS.PHONE.RECENTS.${d.toUpperCase()}`)
                        }, A))
                    })
                }), t("div", {
                    className: "title",
                    children: a("APPS.PHONE.RECENTS.TITLE")
                })]
            })
        }), t("div", {
            className: "content",
            onScroll: O,
            children: t(M.div, {
                ...G(E === "all" ? "left" : "right", E, .2),
                className: "recent-calls",
                children: C.map((d, A) => {
                    var r, P, f;
                    let e = oe(d.number);
                    return i(M.div, {
                        initial: {
                            opacity: 0,
                            scale: .9
                        },
                        whileInView: {
                            opacity: 1,
                            scale: 1
                        },
                        viewport: {
                            once: !0
                        },
                        className: "item",
                        "data-missed": !d.called && !d.answered ? "true" : "false",
                        onClick: () => {
                            if (d.hideCallerId) return;
                            let N;
                            e != null && e.name ? N = e.name : N = V(d.number), _.PopUp.set({
                                title: a("APPS.PHONE.CALL.CALL_TITLE").format({
                                    name: N
                                }),
                                description: a("APPS.PHONE.CALL.CALL_TEXT").format({
                                    name: N
                                }),
                                buttons: [{
                                    title: a("APPS.PHONE.CALL.CALL_BUTTON_CANCEL")
                                }, {
                                    title: a("APPS.PHONE.CALL.CALL_BUTTON_CALL"),
                                    cb: () => {
                                        z({
                                            number: d.number
                                        })
                                    }
                                }]
                            })
                        },
                        children: [i("div", {
                            className: "user",
                            children: [d.hideCallerId ? t("div", {
                                className: "avatar",
                                style: {
                                    backgroundImage: `url(./assets/img/avatar-placeholder-${(f=(P=(r=L)==null?void 0:r.Settings)==null?void 0:P.value)==null?void 0:f.display.theme}.svg)`
                                }
                            }) : e != null && e.avatar ? t("div", {
                                className: "avatar",
                                style: {
                                    backgroundImage: `url(${e==null?void 0:e.avatar})`
                                }
                            }) : t("div", {
                                className: "avatar",
                                children: J(e == null ? void 0 : e.name)
                            }), t("div", {
                                className: "info",
                                children: d.hideCallerId ? i(R, {
                                    children: [a("APPS.PHONE.CALL.NO_CALLER_ID"), t("span", {
                                        children: a("APPS.PHONE.CALL.UNKNOWN")
                                    })]
                                }) : e != null && e.name ? i(R, {
                                    children: [e.name, t("span", {
                                        children: V(d.number)
                                    })]
                                }) : i(R, {
                                    children: [V(d.number), t("span", {
                                        children: a("APPS.PHONE.CALL.UNKNOWN")
                                    })]
                                })
                            })]
                        }), i("div", {
                            className: "info",
                            children: [t("div", {
                                className: "date",
                                children: ke(d.timestamp)
                            }), t(fe, {
                                onClick: N => {
                                    N.stopPropagation();
                                    let m = C.filter(h => h.number === d.number && Math.abs(h.timestamp - d.timestamp) < 36e5),
                                        S = {
                                            timestamp: m[0].timestamp,
                                            calls: m.map(h => {
                                                let g;
                                                return h.called && h.answered && (g = a("APPS.PHONE.RECENTS.OUTGOING_CALL")), h.called && !h.answered && (g = a("APPS.PHONE.RECENTS.CANCELLED_CALL")), !h.called && h.answered && (g = a("APPS.PHONE.RECENTS.INCOMING_CALL")), !h.called && !h.answered && (g = a("APPS.PHONE.RECENTS.MISSED_CALL")), {
                                                    outgoing: h.called,
                                                    responded: h.answered,
                                                    timestamp: h.timestamp,
                                                    duration: h.duration,
                                                    type: g
                                                }
                                            })
                                        };
                                    d.hideCallerId && (d.number = null), c(e != null && e.name ? {
                                        ...e,
                                        number: d.number
                                    } : {
                                        ...d
                                    }, "Recents", S)
                                }
                            })]
                        })]
                    }, A)
                })
            })
        })]
    })
}
const Ce = ue(null),
    W = ue([]);

function Je() {
    const c = T(W);
    o.useEffect(() => {
        me("Phone") && H("Phone", {
            action: "getVoiceMails",
            page: 0
        }, Pe.VoiceMails).then(s => {
            if (!s) return k("error", "Failed to get voicemails");
            k("info", "Received voicemails", s), W.set(s)
        })
    }, []);
    const {
        handleScroll: E
    } = Ae({
        fetchData: s => H("Phone", {
            action: "getVoiceMails",
            page: s
        }),
        onDataFetched: s => W.set([...W.value, ...s]),
        perPage: 25
    });
    return i(M.div, {
        ...G("left", "voicemail", .2),
        className: "animation-container",
        children: [t("div", {
            className: "contacts-header",
            children: t("div", {
                className: "items",
                children: t("div", {
                    className: "title",
                    children: a("APPS.PHONE.VOICEMAIL.TITLE")
                })
            })
        }), t("div", {
            className: "content",
            onScroll: E,
            children: t("div", {
                className: "voicemails",
                children: c.map(s => t(Qe, {
                    data: s
                }, s.id))
            })
        })]
    })
}
const Qe = ({
    data: c
}) => {
    const E = T(ie),
        s = T(L.Settings),
        C = o.useRef(null),
        [v, O] = o.useState(!1),
        [d, A] = o.useState(!1),
        [e, r] = o.useState(!1),
        [P, f] = o.useState(null),
        [N, m] = o.useState(0),
        S = T(Ce),
        [h, g] = o.useState(null),
        I = T(De),
        F = T(Q);
    o.useEffect(() => {
        var u;
        I != null && I.visible && ((u = C.current) == null || u.pause(), r(!1))
    }, [I == null ? void 0 : I.visible, F == null ? void 0 : F.active]), o.useEffect(() => {
        var y, b;
        C.current = new Audio(c.url), C.current.src = c.url, C.current.volume = ((y = s == null ? void 0 : s.sound) == null ? void 0 : y.volume) !== void 0 ? s.sound.volume : .5, C.current.addEventListener("ended", () => {
            r(!1)
        }), C.current.addEventListener("timeupdate", () => {
            m(C.current.currentTime)
        });
        let u = (b = w.APPS.PHONE.contacts) == null ? void 0 : b.value;
        if (u && c.number) {
            let l = u.find(n => n.number == c.number);
            l && g(l)
        }
        return () => {
            var l, n;
            (l = C.current) == null || l.pause(), (n = C.current) == null || n.remove(), C.current = null
        }
    }, []), o.useEffect(() => {
        var u;
        S && S !== c.id && ((u = C.current) == null || u.pause(), r(!1), O(!1))
    }, [S]), o.useEffect(() => {
        s.sound.volume && (C.current.volume = s.sound.volume)
    }, [s.sound.volume]), o.useEffect(() => {
        var u;
        r(!1), m(0), (u = C.current) == null || u.pause(), C.current.currentTime = 0, v && Ce.set(c.id)
    }, [v]);
    const X = u => {
            u = u / 1e3;
            const y = Math.floor(u / 60),
                b = le(u - y * 60, 0);
            return `${y}:${b<10?"0"+b:b}`
        },
        B = (u, y) => {
            const b = new Date(u),
                l = b.getFullYear(),
                n = b.getMonth() + 1,
                p = b.getDate(),
                Y = b.getHours(),
                j = b.getMinutes();
            return y ? `${p} ${b.toLocaleDateString(E.DateLocale,{month:"long"})} ${l} ${a("APPS.PHONE.VOICEMAIL.AT")} ${Y}:${j<10?"0"+j:j}` : `${l}-${n<10?"0"+n:n}-${p<10?"0"+p:p}`
        },
        x = {
            light: {
                active: "#333333",
                track: "#cccccc"
            },
            dark: {
                active: "#FFFFFF",
                track: "#999999"
            }
        };
    return t(M.div, {
        className: "voicemail-item",
        initial: {
            opacity: 0,
            scale: .9
        },
        whileInView: {
            opacity: 1,
            scale: 1
        },
        viewport: {
            once: !0
        },
        onClick: () => O(!v),
        "data-expanded": v,
        children: i("div", {
            className: "voicemail-info",
            children: [i("div", {
                className: "voicemail-row",
                children: [i("div", {
                    className: "details",
                    children: [t("div", {
                        className: "voicemail-title",
                        children: c.hideCallerId ? a("APPS.PHONE.CALL.NO_CALLER_ID") : h ? K(h == null ? void 0 : h.firstname, h == null ? void 0 : h.lastname) : V(c.number)
                    }), t("div", {
                        className: "subtitle",
                        children: B(c.timestamp, !0)
                    })]
                }), !v && t("div", {
                    className: "info",
                    children: t("div", {
                        className: "duration",
                        children: X(c.duration)
                    })
                })]
            }), t(_e, {
                children: v && i(M.div, {
                    className: "voicemail-actions",
                    initial: {
                        opacity: 0,
                        height: 0
                    },
                    animate: {
                        opacity: 1,
                        height: "auto"
                    },
                    exit: {
                        opacity: 0,
                        height: 0
                    },
                    children: [i("div", {
                        className: "voicemail-duration-slider",
                        onClick: u => u.stopPropagation(),
                        children: [t($, {
                            type: "range",
                            min: 0,
                            max: 100,
                            value: P || N / c.duration * 100,
                            style: {
                                background: `linear-gradient(to right, ${x[s.display.theme].active} 0%, ${x[s.display.theme].active} ${P||N/(c.duration/1e3)*100}%, ${x[s.display.theme].track} ${P||N/(c.duration/1e3)*100}%, ${x[s.display.theme].track} 100%)`
                            },
                            onMouseDown: u => {
                                me("Phone") && (u.stopPropagation(), A(!0))
                            },
                            onMouseUp: u => {
                                if (u.stopPropagation(), A(!1), P) {
                                    if (!C.current) return k("warning", "Audio ref is null");
                                    C.current.currentTime = c.duration / 1e3 / 100 * P, f(null)
                                }
                            },
                            onChange: u => {
                                u.stopPropagation(), f(u.target.value)
                            }
                        }), i("div", {
                            className: "duration",
                            children: [t("div", {
                                children: X(N) ?? "0:00"
                            }), t("div", {
                                children: X(c.duration)
                            })]
                        })]
                    }), i("div", {
                        className: "voicemail-item-footer",
                        children: [t("div", {
                            className: "play",
                            onClick: u => {
                                if (u.stopPropagation(), !C.current) return k("warning", "Audio ref is null");
                                e ? C.current.pause() : C.current.play().catch(() => k("error", "Failed to play voicemail", c.id)), r(!e)
                            },
                            children: e ? t(we, {}) : t(Re, {})
                        }), i("div", {
                            className: "buttons",
                            children: [c.number && i(R, {
                                children: [t(de, {
                                    className: "green",
                                    onClick: u => {
                                        u.stopPropagation(), _.PopUp.set({
                                            title: a("APPS.PHONE.VOICEMAIL.CALL_POPUP.TITLE"),
                                            description: a("APPS.PHONE.VOICEMAIL.CALL_POPUP.DESCRIPTION").format({
                                                number: V(c.number)
                                            }),
                                            buttons: [{
                                                title: a("APPS.PHONE.VOICEMAIL.CALL_POPUP.CANCEL")
                                            }, {
                                                title: a("APPS.PHONE.VOICEMAIL.CALL_POPUP.PROCEED"),
                                                cb: () => {
                                                    z({
                                                        number: c.number
                                                    })
                                                }
                                            }]
                                        })
                                    }
                                }), t(he, {
                                    className: "blue",
                                    onClick: u => {
                                        u.stopPropagation(), Q.patch({
                                            active: {
                                                name: "Messages",
                                                data: {
                                                    number: c.number,
                                                    name: (h == null ? void 0 : h.firstname) && K(h.firstname, h.lastname),
                                                    avatar: h == null ? void 0 : h.avatar
                                                },
                                                view: "messages"
                                            }
                                        })
                                    }
                                })]
                            }), t(Me, {
                                className: "red",
                                onClick: u => {
                                    u.stopPropagation(), _.PopUp.set({
                                        title: a("APPS.PHONE.VOICEMAIL.DELETE_POPUP.TITLE"),
                                        description: a("APPS.PHONE.VOICEMAIL.DELETE_POPUP.DESCRIPTION"),
                                        buttons: [{
                                            title: a("APPS.PHONE.VOICEMAIL.DELETE_POPUP.CANCEL")
                                        }, {
                                            title: a("APPS.PHONE.VOICEMAIL.DELETE_POPUP.PROCEED"),
                                            cb: () => {
                                                H("Phone", {
                                                    action: "deleteVoiceMail",
                                                    id: c.id
                                                }, !0).then(y => {
                                                    if (!y) return k("error", "Failed to delete voicemail");
                                                    k("info", "Deleted voicemail", c.id), W.set(W.value.filter(b => b.id !== c.id))
                                                })
                                            }
                                        }]
                                    })
                                }
                            })]
                        })]
                    })]
                })
            })]
        })
    })
};
const q = o.createContext(null);

function et() {
    const c = T(Q).active,
        [E, s] = o.useState("Contacts"),
        [C, v] = o.useState(null),
        O = T(w.APPS.PHONE.contacts),
        d = (r, P, f) => {
            v({
                ...r,
                callData: f,
                from: P
            }), s("Contact")
        };
    o.useEffect(() => {
        var r, P;
        if (O && c != null && c.data)
            if (((r = c.data) == null ? void 0 : r.view) === "contact") {
                let f = O == null ? void 0 : O.find(N => N.number == c.data.number);
                if (!f) return;
                v({
                    ...f || {
                        number: c.data.number
                    },
                    from: "Contacts"
                }), s("Contact")
            } else((P = c.data) == null ? void 0 : P.view) === "newContact" && (v({
                number: c.data.number,
                from: "Contacts"
            }), s("NewContact"))
    }, []);
    const A = {
            Favourites: t(Ye, {}),
            Contacts: t(Xe, {}),
            Recents: t(We, {}),
            Keypad: t(ze, {}),
            NewContact: t(qe, {}),
            Contact: t(Be, {}),
            Voicemail: t(Je, {})
        },
        e = {
            Favourites: t(Ve, {}),
            Recents: t(xe, {}),
            Contacts: t(se, {}),
            Keypad: t($e, {}),
            Voicemail: t(Fe, {})
        };
    return i("div", {
        className: "phone-app-container",
        children: [t(q.Provider, {
            value: {
                Contact: [C, v],
                View: [E, s],
                viewContact: d
            },
            children: t("div", {
                className: "wrapper",
                children: A[E]
            })
        }), t("div", {
            className: "footer",
            children: Object.keys(e).map((r, P) => i("div", {
                className: Ue("item", E == r && "active"),
                onClick: () => s(r),
                children: [e[r], t("span", {
                    children: a(`APPS.PHONE.${r.toUpperCase()}.TITLE`)
                })]
            }, P))
        })]
    })
}
export {
    q as PhoneContext, et as
    default
};