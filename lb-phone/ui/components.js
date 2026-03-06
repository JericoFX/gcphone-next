if (!globalThis.componentsLoaded) {
    globalThis.componentsLoaded = true;

    globalThis.fetchNui = async (event, data, scriptName) => {
        scriptName = scriptName || globalThis.resourceName;

        if (scriptName !== globalThis.resourceName) {
            console.warn(`The app ${appName} (${globalThis.resourceName}) is fetching from another resource (${scriptName}), this will soon be blocked by FiveM. Read more: https://forum.cfx.re/t/5261145`);
        }

        try {
            const response = await fetch(`https://${scriptName}/${event}`, {
                method: 'post',
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error(`${response.status} - ${response.statusText}`);

            return await response.json();
        } catch (err) {
            console.error(`Error fetching ${event} from ${scriptName}`, err);
        }
    };

    function onNuiEvent(eventName, cb) {
        window.addEventListener('message', (event) => {
            if (event.data?.action === eventName) {
                cb(event.data.data);
            }
        });
    }

    globalThis.useNuiEvent = onNuiEvent;

    let currentPopUpInputCb = null;

    function setPopUp(data) {
        currentPopUpInputCb = null;

        if (!data?.buttons) return;

        for (let i = 0; i < data.buttons.length; i++) {
            if (data.buttons[i].cb) data.buttons[i].callbackId = i;
        }

        if (data.input?.onChange) {
            currentPopUpInputCb = data.input.onChange;
            data.input.onChange = true;
        }

        globalThis.components.fetchPhone('SetPopUp', data).then((buttonId) => {
            if (!data.buttons[buttonId]?.cb) return;
            data.buttons[buttonId].cb();
        });
    }

    function setContextMenu(data) {
        if (!data?.buttons) return;

        for (let i = 0; i < data.buttons.length; i++) {
            if (data.buttons[i].cb) data.buttons[i].callbackId = i;
        }

        globalThis.components.fetchPhone('SetContextMenu', data).then((buttonId) => {
            if (!data.buttons[buttonId]?.cb) return;
            data.buttons[buttonId].cb();
        });
    }

    function setContactModal(number) {
        if (!number) return;

        globalThis.components.fetchPhone('SetContactModal', number);
    }

    function useComponent(cb, data) {
        if (!cb || !data?.component) return;

        globalThis.components
            .fetchPhone('ShowComponent', data)
            .then((data) => {
                cb(data);
            })
            .catch((err) => {
                console.log(err);
                cb(null);
            });
    }

    function selectGallery(data) {
        useComponent(data.cb, { ...data, component: 'gallery' });
    }

    function selectGIF(cb) {
        useComponent(cb, { component: 'gif' });
    }

    function selectEmoji(cb) {
        useComponent(cb, { component: 'emoji' });
    }

    function useCamera(cb, data) {
        useComponent(cb, { ...data, component: 'camera' });
    }

    function colorPicker(cb, data) {
        useComponent(cb, { ...data, customApp: true, component: 'colorpicker' });
    }

    function contactSelector(cb, data) {
        useComponent(cb, { ...data, component: 'contactselector' });
    }

    function getSettings() {
        return globalThis.components.fetchPhone('GetSettings');
    }

    function getLocale(path, format) {
        return globalThis.components.fetchPhone('GetLocale', { path, format });
    }

    function sendNotification(data) {
        data.app = globalThis.appIdentifier;
        if (!data?.title && !data?.content) return console.log('Invalid notification data');
        globalThis.components.fetchPhone('SendNotification', data);
    }

    let settingsListeners = [];

    function onSettingsChange(cb) {
        if (!cb) return;

        settingsListeners.push(cb);
    }

    function removeSettingsChangeListener(cb) {
        settingsListeners = settingsListeners.filter((listener) => listener !== cb);
    }

    globalThis.addEventListener('message', (event) => {
        const data = event.data;
        const type = data.type;

        if (type === 'settingsUpdated') {
            settingsListeners.forEach((cb) => cb(data.settings));
        } else if (type === 'popUpInputChanged') {
            if (currentPopUpInputCb) currentPopUpInputCb(data.value);
        }
    });

    function toggleInput(toggle) {
        globalThis.components.fetchPhone('toggleInput', toggle);
    }

    let addedHandlers = [];

    function refreshInputs(inputs) {
        inputs.forEach((input) => {
            if (input.type === 'range') return;
            if (addedHandlers.includes(input)) return console.log('already added handler for', input);

            input.addEventListener('focus', () => toggleInput(true));
            input.addEventListener('blur', () => toggleInput(false));
        });
    }

    refreshInputs(document.querySelectorAll('input, textarea'));

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.childNodes.length > 0) refreshInputs(node.querySelectorAll('input, textarea'));
                if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') refreshInputs([node]);
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    function createCall(data) {
        globalThis.components.fetchPhone('CreateCall', data);
    }

    globalThis.SetPopUp = setPopUp;
    globalThis.SetContextMenu = setContextMenu;
    globalThis.SetContactModal = setContactModal;
    globalThis.UseComponent = useComponent;
    globalThis.SelectGallery = selectGallery;
    globalThis.SelectGIF = selectGIF;
    globalThis.SelectEmoji = selectEmoji;
    globalThis.GetSettings = getSettings;
    globalThis.GetLocale = getLocale;
    globalThis.SendNotification = sendNotification;
    globalThis.OnSettingsChange = onSettingsChange;

    globalThis.postMessage('componentsLoaded', '*');
}
