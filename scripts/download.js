export class CDownload {
    #Target;
    #Active = null;

    constructor( Target ) {
        this.#Target = Target;
    }

    Cancel() {
        this.#Active?.abort();
    }

    async Start( Key ) {
        this.Cancel();
        const Controller = new AbortController();
        this.#Active = Controller;
        let Widget = null;

        try {
            // Static deploy: there is no /api/site/*. Say so plainly instead of
            // surfacing a JSON parse failure from a 404 page.
            if ( !window.LucidConfig?.installerUrl ) {
                throw new Error( 'Downloads are not available on this copy of the site.' );
            }
            const Config = await this.#Fetch( '/api/site/config', Controller.signal );
            const SiteKey = Config.Data?.TurnstileKey;
            let Proof = '';

            if ( typeof SiteKey === 'string' && SiteKey.length ) {
                await this.#Load( Controller.signal );
                Controller.signal.throwIfAborted();
                Proof = await new Promise( ( Resolve, Reject ) => {
                    const Finish = ( Failure, Token = '' ) => {
                        clearTimeout( Timer );
                        Controller.signal.removeEventListener( 'abort', Abort );
                        if ( Failure )
                            Reject( Failure );
                        else
                            Resolve( Token );
                    };
                    const Abort = () => Finish( Controller.signal.reason );
                    const Failed = () => Finish( new Error( 'Verification failed. Please try again.' ) );
                    const Timer = setTimeout( Failed, 90000 );
                    Controller.signal.addEventListener( 'abort', Abort, { once: true } );

                    try {
                        Widget = window.turnstile.render( this.#Target, {
                            sitekey: SiteKey,
                            action: 'site-download',
                            theme: 'auto',
                            size: this.#Target.clientWidth < 300 ? 'compact' : 'flexible',
                            appearance: 'interaction-only',
                            retry: 'never',
                            'response-field': false,
                            'refresh-expired': 'never',
                            callback: Token => typeof Token === 'string' && Token.length > 0 && Token.length <= 2048 ? Finish( null, Token ) : Failed(),
                            'error-callback': Failed,
                            'expired-callback': Failed,
                            'timeout-callback': Failed
                        } );
                        if ( Widget === null || Widget === undefined )
                            Failed();
                    } catch {
                        Failed();
                    }
                } );
            } else if ( SiteKey !== null || ![ 'localhost', '127.0.0.1', '[::1]' ].includes( location.hostname ) ) {
                throw new Error( 'Verification is unavailable. Please try again later.' );
            }

            Controller.signal.throwIfAborted();
            const Started = Date.now();
            const Result = await this.#Fetch( '/api/site/download', Controller.signal, { Key, Turnstile: Proof } );
            const Data = Result.Data;
            const Lifetime = Date.parse( Data?.ExpiresAt ) - Date.parse( Result.Meta?.ServerTime );

            if ( Data?.FileName !== 'aether.txt' || typeof Data.Url !== 'string' || !/^\/download\/[a-f0-9]{64}\/Lucid\.exe\?verify=[A-Za-z0-9._~-]+$/.test( Data.Url ) || !Number.isFinite( Lifetime ) || Lifetime <= 0 || Lifetime > 600000 )
                throw new Error( 'The download could not be prepared. Please try again.' );

            return { Url: Data.Url, ExpiresAt: Started + Lifetime };
        } catch ( Failure ) {
            if ( Failure.name === 'TimeoutError' )
                throw new Error( 'The check took too long. Please try again.' );
            if ( Failure instanceof TypeError )
                throw new Error( 'Could not reach the server. Check your connection.' );
            throw Failure;
        } finally {
            if ( Widget !== null && Widget !== undefined ) {
                try {
                    window.turnstile?.remove( Widget );
                } catch {}
            }
            if ( this.#Active === Controller ) {
                this.#Active = null;
                this.#Target.replaceChildren();
            }
        }
    }

    async #Fetch( Path, Signal, Body ) {
        const Response = await fetch( Path, {
            method: Body ? 'POST' : 'GET',
            headers: { 'Api-Version': '1', Accept: 'application/json', ...( Body ? { 'Content-Type': 'application/json' } : {} ) },
            body: Body ? JSON.stringify( Body ) : undefined,
            cache: 'no-store',
            credentials: 'omit',
            mode: 'same-origin',
            redirect: 'error',
            referrerPolicy: 'same-origin',
            signal: AbortSignal.any( [ Signal, AbortSignal.timeout( 20000 ) ] )
        } );
        const Result = await Response.json().catch( () => null );
        if ( !Response.ok || !Result?.Data ) {
            const Messages = {
                KeyRejected: 'That line could not be prepared. Check it and try again.',
                KeyInvalid: 'Paste the full loader line.',
                CaptchaFailed: 'Verification failed. Please try again.',
                CsrfFailed: 'Reload the page and try again.',
                RateLimited: 'Too many attempts. Please wait before trying again.',
                DownloadUnavailable: 'Downloads are paused right now. Try again soon.'
            };
            throw new Error( Messages[ Result?.Error?.Code ] || 'The download could not be prepared. Please try again.' );
        }
        return Result;
    }

    #Load( Signal ) {
        if ( window.turnstile?.render )
            return Promise.resolve();

        return new Promise( ( Resolve, Reject ) => {
            const Script = document.createElement( 'script' );
            const Finish = Failure => {
                clearTimeout( Timer );
                Signal.removeEventListener( 'abort', Abort );
                Script.onload = null;
                Script.onerror = null;
                if ( Failure ) {
                    Script.remove();
                    Reject( Failure );
                } else {
                    Resolve();
                }
            };
            const Abort = () => Finish( Signal.reason );
            const Failed = () => Finish( new Error( 'Verification could not load. Please try again.' ) );
            const Timer = setTimeout( Failed, 15000 );
            Signal.addEventListener( 'abort', Abort, { once: true } );
            Script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            Script.async = true;
            Script.onerror = Failed;
            Script.onload = () => window.turnstile?.render ? Finish() : Failed();
            document.head.append( Script );
            if ( Signal.aborted )
                Abort();
        } );
    }
}
