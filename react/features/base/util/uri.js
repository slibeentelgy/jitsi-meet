/**
 * The {@link RegExp} pattern of the authority of a URI.
 *
 * @private
 * @type {string}
 */
const _URI_AUTHORITY_PATTERN = '(//[^/?#]+)';

/**
 * The {@link RegExp} pattern of the path of a URI.
 *
 * @private
 * @type {string}
 */
const _URI_PATH_PATTERN = '([^?#]*)';

/**
 * The {@link RegExp} pattern of the protocol of a URI.
 *
 * @private
 * @type {string}
 */
const _URI_PROTOCOL_PATTERN = '([a-z][a-z0-9\\.\\+-]*:)';

/**
 * Fixes the hier-part of a specific URI (string) so that the URI is well-known.
 * For example, certain Jitsi Meet deployments are not conventional but it is
 * possible to translate their URLs into conventional.
 *
 * @param {string} uri - The URI (string) to fix the hier-part of.
 * @private
 * @returns {string}
 */
function _fixURIStringHierPart(uri) {
    // Rewrite the specified URL in order to handle special cases such as
    // hipchat.com and enso.me which do not follow the common pattern of most
    // Jitsi Meet deployments.

    // hipchat.com
    let regex
        = new RegExp(
            `^${_URI_PROTOCOL_PATTERN}//hipchat\\.com/video/call/`,
            'gi');
    let match = regex.exec(uri);

    if (!match) {
        // enso.me
        regex
            = new RegExp(
                `^${_URI_PROTOCOL_PATTERN}//enso\\.me/(?:call|meeting)/`,
                'gi');
        match = regex.exec(uri);
    }
    if (match) {
        /* eslint-disable no-param-reassign, prefer-template */

        uri
            = match[1] /* protocol */
                + '//enso.hipchat.me/'
                + uri.substring(regex.lastIndex); /* room (name) */

        /* eslint-enable no-param-reassign, prefer-template */
    }

    return uri;
}

/**
 * Fixes the scheme part of a specific URI (string) so that it contains a
 * well-known scheme such as HTTP(S). For example, the mobile app implements an
 * app-specific URI scheme in addition to Universal Links. The app-specific
 * scheme may precede or replace the well-known scheme. In such a case, dealing
 * with the app-specific scheme only complicates the logic and it is simpler to
 * get rid of it (by translating the app-specific scheme into a well-known
 * scheme).
 *
 * @param {string} uri - The URI (string) to fix the scheme of.
 * @private
 * @returns {string}
 */
function _fixURIStringScheme(uri: string) {
    const regex = new RegExp(`^${_URI_PROTOCOL_PATTERN}+`, 'gi');
    const match = regex.exec(uri);

    if (match) {
        // As an implementation convenience, pick up the last scheme and make
        // sure that it is a well-known one.
        let protocol = match[match.length - 1].toLowerCase();

        if (protocol !== 'http:' && protocol !== 'https:') {
            protocol = 'https:';
        }

        /* eslint-disable no-param-reassign */

        uri = uri.substring(regex.lastIndex);
        if (uri.startsWith('//')) {
            // The specified URL was not a room name only, it contained an
            // authority.
            uri = protocol + uri;
        }

        /* eslint-enable no-param-reassign */
    }

    return uri;
}

/**
 * Gets the (Web application) context root defined by a specific location (URI).
 *
 * @param {Object} location - The location (URI) which defines the (Web
 * application) context root.
 * @public
 * @returns {string} - The (Web application) context root defined by the
 * specified {@code location} (URI).
 */
export function getLocationContextRoot(location: Object) {
    const pathname = location.pathname;
    const contextRootEndIndex = pathname.lastIndexOf('/');

    return (
        contextRootEndIndex === -1
            ? '/'
            : pathname.substring(0, contextRootEndIndex + 1));
}

/**
 * Constructs a new {@code Array} with URL parameter {@code String}s out of a
 * specific {@code Object}.
 *
 * @param {Object} obj - The {@code Object} to turn into URL parameter
 * {@code String}s.
 * @returns {Array<string>} The {@code Array} with URL parameter {@code String}s
 * constructed out of the specified {@code obj}.
 */
function _objectToURLParamsArray(obj = {}) {
    const params = [];

    for (const key in obj) { // eslint-disable-line guard-for-in
        try {
            params.push(
                `${key}=${encodeURIComponent(JSON.stringify(obj[key]))}`);
        } catch (e) {
            console.warn(`Error encoding ${key}: ${e}`);
        }
    }

    return params;
}

/**
 * Parses a specific URI string into an object with the well-known properties of
 * the {@link Location} and/or {@link URL} interfaces implemented by Web
 * browsers. The parsing attempts to be in accord with IETF's RFC 3986.
 *
 * @param {string} str - The URI string to parse.
 * @public
 * @returns {{
 *     hash: string,
 *     host: (string|undefined),
 *     hostname: (string|undefined),
 *     pathname: string,
 *     port: (string|undefined),
 *     protocol: (string|undefined),
 *     search: string
 * }}
 */
export function parseStandardURIString(str: string) {
    /* eslint-disable no-param-reassign */

    const obj = {
        toString: _standardURIToString
    };

    let regex;
    let match;

    // protocol
    regex = new RegExp(`^${_URI_PROTOCOL_PATTERN}`, 'gi');
    match = regex.exec(str);
    if (match) {
        obj.protocol = match[1].toLowerCase();
        str = str.substring(regex.lastIndex);
    }

    // authority
    regex = new RegExp(`^${_URI_AUTHORITY_PATTERN}`, 'gi');
    match = regex.exec(str);
    if (match) {
        let authority = match[1].substring(/* // */ 2);

        str = str.substring(regex.lastIndex);

        // userinfo
        const userinfoEndIndex = authority.indexOf('@');

        if (userinfoEndIndex !== -1) {
            authority = authority.substring(userinfoEndIndex + 1);
        }

        obj.host = authority;

        // port
        const portBeginIndex = authority.lastIndexOf(':');

        if (portBeginIndex !== -1) {
            obj.port = authority.substring(portBeginIndex + 1);
            authority = authority.substring(0, portBeginIndex);
        }

        // hostname
        obj.hostname = authority;
    }

    // pathname
    regex = new RegExp(`^${_URI_PATH_PATTERN}`, 'gi');
    match = regex.exec(str);

    let pathname;

    if (match) {
        pathname = match[1];
        str = str.substring(regex.lastIndex);
    }
    if (pathname) {
        pathname.startsWith('/') || (pathname = `/${pathname}`);
    } else {
        pathname = '/';
    }
    obj.pathname = pathname;

    // query
    if (str.startsWith('?')) {
        let hashBeginIndex = str.indexOf('#', 1);

        if (hashBeginIndex === -1) {
            hashBeginIndex = str.length;
        }
        obj.search = str.substring(0, hashBeginIndex);
        str = str.substring(hashBeginIndex);
    } else {
        obj.search = ''; // Google Chrome
    }

    // fragment
    obj.hash = str.startsWith('#') ? str : '';

    /* eslint-enable no-param-reassign */

    return obj;
}

/**
 * Parses a specific URI which (supposedly) references a Jitsi Meet resource
 * (location).
 *
 * @param {(string|undefined)} uri - The URI to parse which (supposedly)
 * references a Jitsi Meet resource (location).
 * @public
 * @returns {{
 *     room: (string|undefined)
 * }}
 */
export function parseURIString(uri: ?string) {
    if (typeof uri !== 'string') {
        return undefined;
    }

    const obj
        = parseStandardURIString(
            _fixURIStringHierPart(_fixURIStringScheme(uri)));

    // Add the properties that are specific to a Jitsi Meet resource (location)
    // such as contextRoot, room:

    // contextRoot
    obj.contextRoot = getLocationContextRoot(obj);

    // The room (name) is the last component of pathname.
    const { pathname } = obj;

    obj.room = pathname.substring(pathname.lastIndexOf('/') + 1) || undefined;

    return obj;
}

/**
 * Implements {@code href} and {@code toString} for the {@code Object} returned
 * by {@link #parseStandardURIString}.
 *
 * @param {Object} [thiz] - An {@code Object} returned by
 * {@code #parseStandardURIString} if any; otherwise, it is presumed that the
 * function is invoked on such an instance.
 * @returns {string}
 */
function _standardURIToString(thiz: ?Object) {
    // eslint-disable-next-line no-invalid-this
    const { hash, host, pathname, protocol, search } = thiz || this;
    let str = '';

    protocol && (str += protocol);

    // TODO userinfo

    host && (str += `//${host}`);
    str += pathname || '/';
    search && (str += search);
    hash && (str += hash);

    return str;
}

/**
 * Attempts to return a {@code String} representation of a specific
 * {@code Object} which is supposed to represent a URL. Obviously, if a
 * {@code String} is specified, it is returned. If a {@code URL} is specified,
 * its {@code URL#href} is returned. Additionally, an {@code Object} similar to
 * the one accepted by the constructor of Web's ExternalAPI is supported on both
 * mobile/React Native and Web/React.
 *
 * @param {string|Object} obj - The URL to return a {@code String}
 * representation of.
 * @returns {string} - A {@code String} representation of the specified
 * {@code obj} which is supposed to represent a URL.
 */
export function toURLString(obj: ?(string | Object)): ?string {
    let str;

    switch (typeof obj) {
    case 'object':
        if (obj) {
            if (obj instanceof URL) {
                str = obj.href;
            } else {
                str = urlObjectToString(obj);
            }
        }
        break;

    case 'string':
        str = String(obj);
        break;
    }

    return str;
}

/**
 * Attempts to return a {@code String} representation of a specific
 * {@code Object} similar to the one accepted by the constructor
 * of Web's ExternalAPI.
 *
 * @param {Object} o - The URL to return a {@code String} representation of.
 * @returns {string} - A {@code String} representation of the specified
 * {@code Object}.
 */
export function urlObjectToString(o: Object): ?string {
    const url = parseStandardURIString(_fixURIStringScheme(o.url || ''));

    // protocol
    if (!url.protocol) {
        let protocol = o.protocol || o.scheme;

        if (protocol) {
            // Protocol is supposed to be the scheme and the final ':'. Anyway,
            // do not make a fuss if the final ':' is not there.
            protocol.endsWith(':') || (protocol += ':');
            url.protocol = protocol;
        }
    }

    // authority & pathname
    let { pathname } = url;

    if (!url.host) {
        // Web's ExternalAPI domain
        //
        // It may be host/hostname and pathname with the latter denoting the
        // tenant.
        const domain = o.domain || o.host || o.hostname;

        if (domain) {
            const { host, hostname, pathname: contextRoot, port }
                = parseStandardURIString(

                    // XXX The value of domain in supposed to be host/hostname
                    // and, optionally, pathname. Make sure it is not taken for
                    // a pathname only.
                    _fixURIStringScheme(`org.jitsi.meet://${domain}`));

            // authority
            if (host) {
                url.host = host;
                url.hostname = hostname;
                url.port = port;
            }

            // pathname
            pathname === '/' && contextRoot !== '/' && (pathname = contextRoot);
        }
    }

    // pathname

    // Web's ExternalAPI roomName
    const room = o.roomName || o.room;

    if (room
            && (url.pathname.endsWith('/')
                || !url.pathname.endsWith(`/${room}`))) {
        pathname.endsWith('/') || (pathname += '/');
        pathname += room;
    }

    url.pathname = pathname;

    // query/search

    // Web's ExternalAPI jwt
    const { jwt } = o;

    if (jwt) {
        let { search } = url;

        if (search.indexOf('?jwt=') === -1 && search.indexOf('&jwt=') === -1) {
            search.startsWith('?') || (search = `?${search}`);
            search.length === 1 || (search += '&');
            search += `jwt=${jwt}`;

            url.search = search;
        }
    }

    // fragment/hash

    let { hash } = url;

    for (const configName of [ 'config', 'interfaceConfig' ]) {
        const urlParamsArray
            = _objectToURLParamsArray(
                o[`${configName}Overwrite`]
                    || o[configName]
                    || o[`${configName}Override`]);

        if (urlParamsArray.length) {
            let urlParamsString
                = `${configName}.${urlParamsArray.join(`&${configName}.`)}`;

            if (hash.length) {
                urlParamsString = `&${urlParamsString}`;
            } else {
                hash = '#';
            }
            hash += urlParamsString;
        }
    }

    url.hash = hash;

    return url.toString() || undefined;
}
