import { CDownload } from './download.js';

(( ) => {
    const Dialog = document.querySelector( '[data-licence-dialog]' );
    if ( !Dialog || typeof Dialog.showModal !== 'function' )
        return;

    const Form = Dialog.querySelector( '[data-licence-form]' );
    const Input = Dialog.querySelector( '[data-licence-input]' );
    const Field = Dialog.querySelector( '[data-licence-field]' );
    const TypedGhost = Dialog.querySelector( '[data-licence-typed]' );
    const RestGhost = Dialog.querySelector( '[data-licence-rest]' );
    const Counter = Dialog.querySelector( '[data-licence-count]' );
    const Message = Dialog.querySelector( '[data-licence-error]' );
    const SubmitButton = Dialog.querySelector( '[data-licence-submit]' );
    const PasteButton = Dialog.querySelector( '[data-licence-paste]' );
    const FormView = Dialog.querySelector( '[data-licence-view="form"]' );
    const FormTitle = FormView.querySelector( 'h2' );
    const SuccessView = Dialog.querySelector( '[data-licence-view="success"]' );
    const SuccessTitle = SuccessView.querySelector( 'h2' );
    const SuccessMessage = SuccessView.querySelector( '[data-licence-message]' );
    const AgainButton = SuccessView.querySelector( '[data-licence-again]' );
    const SuccessPricing = SuccessView.querySelector( '[data-licence-pricing]' );
    const Download = new CDownload( Dialog.querySelector( '[data-licence-check]' ) );

    const ReducedMotion = window.matchMedia( '(prefers-reduced-motion: reduce)' );
    const FinePointer = window.matchMedia( '(hover: hover) and (pointer: fine)' );
    const AppleDevice = /Mac|iPhone|iPad/.test( navigator.userAgentData?.platform || navigator.platform || '' );
    const KeyPrefix = 'AETHER';
    const KeyTemplate = 'AETHER-LOADER-LINE';
    const KeyLength = 15;
    // no key format: any loader line the user pastes is accepted
    const KeyPattern = /^.{8,}$/;
    const Copy = {
        Incomplete: 'Enter all 15 characters of your key.',
        Rejected: 'That key could not be verified.',
        Shortcut: `Clipboard is blocked. Press ${AppleDevice ? 'Cmd' : 'Ctrl'}+V to paste.`,
        Touch: 'Clipboard is blocked. Long-press the field to paste.',
        Starting: 'Loader copied. Paste it into your executor to start Aether.'
    };

    let Phase = 'idle';
    let Completed = false;
    let Generation = 0;
    let ReturnFocus = null;
    let PendingLink = '';
    let DownloadDetails = null;
    let ViewMorph = null;
    let CloseTimer = 0;
    let MessageTimer = 0;
    let PressedBackdrop = false;

    function Token( Name, Fallback ) {
        return getComputedStyle( document.documentElement ).getPropertyValue( Name ).trim( ) || Fallback;
    }

    function Significant( Text ) {
        return String( Text ).toUpperCase( ).replace( /[^A-Z0-9]/g, '' );
    }

    function KeyBody( Text ) {
        const Characters = Significant( Text );
        if ( KeyPrefix.startsWith( Characters ) )
            return '';
        const Body = Characters.startsWith( KeyPrefix ) ? Characters.slice( KeyPrefix.length ) : Characters;
        return Body.slice( 0, KeyLength );
    }

    function FormatKey( Text ) {
        const Characters = Significant( Text );
        if ( KeyPrefix.startsWith( Characters ) )
            return Characters;
        return [ KeyPrefix, ...KeyBody( Characters ).match( /.{1,5}/g ) ].join( '-' );
    }

    function CaretIndex( Formatted, Count ) {
        let Seen = 0;
        for ( let Index = 0; Index < Formatted.length; Index += 1 ) {
            if ( Seen === Count )
                return Index;
            if ( Formatted[ Index ] !== '-' )
                Seen += 1;
        }
        return Formatted.length;
    }

    function UpdateOverflow( ) {
        Field.toggleAttribute( 'data-overflow', Input.scrollWidth > Input.clientWidth + 1 );
    }

    function Render( Formatted ) {
        const Filled = KeyBody( Formatted ).length;
        const Complete = KeyPattern.test( Formatted );
        Counter.textContent = `${Filled}/${KeyLength}`;
        TypedGhost.textContent = Formatted;
        RestGhost.textContent = KeyTemplate.slice( Formatted.length );
        Form.toggleAttribute( 'data-complete', Complete );
        SubmitButton.disabled = !Complete;
        if ( Dialog.open )
            UpdateOverflow( );
    }

    function ApplyValue( Raw, Caret = Raw.length ) {
        const Characters = Significant( Raw );
        const Prefixed = !KeyPrefix.startsWith( Characters ) && !Characters.startsWith( KeyPrefix );
        const Before = Significant( Raw.slice( 0, Caret ) ).length + ( Prefixed ? KeyPrefix.length : 0 );
        const Formatted = FormatKey( Raw );
        Input.value = Formatted;
        if ( document.activeElement === Input ) {
            const Position = CaretIndex( Formatted, Before );
            Input.setSelectionRange( Position, Position );
        }
        Render( Formatted );
    }

    function InsertText( Text ) {
        if ( KeyBody( Text ).length === KeyLength ) {
            ApplyValue( Text );
            return;
        }
        const Start = Input.selectionStart ?? Input.value.length;
        const End = Input.selectionEnd ?? Start;
        ApplyValue( Input.value.slice( 0, Start ) + Text + Input.value.slice( End ), Start + Text.length );
    }

    function Shake( ) {
        if ( ReducedMotion.matches )
            return;
        Field.removeAttribute( 'data-shake' );
        void Field.offsetWidth;
        Field.setAttribute( 'data-shake', '' );
    }

    function ShowMessage( Text, Tone ) {
        window.clearTimeout( MessageTimer );
        Form.dataset.message = Tone;
        Input.setAttribute( 'aria-invalid', String( Tone === 'error' ) );
        Message.textContent = '';
        requestAnimationFrame( ( ) => {
            Message.textContent = Text;
        } );
        if ( Tone === 'error' )
            Shake( );
    }

    function ClearMessage( ) {
        if ( !Form.dataset.message )
            return;
        delete Form.dataset.message;
        Input.setAttribute( 'aria-invalid', 'false' );
        window.clearTimeout( MessageTimer );
        MessageTimer = window.setTimeout( ( ) => {
            Message.textContent = '';
        }, 360 );
    }

    function SetBusy( Busy ) {
        Phase = Busy ? 'checking' : 'idle';
        Input.readOnly = Busy;
        if ( Busy ) {
            SubmitButton.setAttribute( 'aria-busy', 'true' );
            SubmitButton.setAttribute( 'aria-label', 'Checking your key' );
        } else {
            SubmitButton.removeAttribute( 'aria-busy' );
            SubmitButton.removeAttribute( 'aria-label' );
        }
    }

    function StartDownload( ) {
        if ( !DownloadDetails )
            return;
        if ( Date.now( ) >= DownloadDetails.ExpiresAt - 5000 ) {
            Reset( );
            ShowMessage( 'Your download link expired. Enter your key again.', 'error' );
            Input.focus( { preventScroll: true } );
            return;
        }
        const Anchor = document.createElement( 'a' );
        Anchor.href = DownloadDetails.Url;
        Anchor.download = 'aether.txt';
        Anchor.rel = 'noopener noreferrer';
        Anchor.referrerPolicy = 'no-referrer';
        Anchor.hidden = true;
        document.body.append( Anchor );
        Anchor.click( );
        Anchor.remove( );
    }

    function FinishSwap( FromView, ToView ) {
        FromView.hidden = true;
        FromView.inert = false;
        delete FromView.dataset.state;
        delete ToView.dataset.state;
        Dialog.removeAttribute( 'data-morphing' );
        ViewMorph?.cancel( );
        ViewMorph = null;
    }

    function SwapView( FromView, ToView, FocusTarget ) {
        const StartHeight = Dialog.offsetHeight;
        const FromHeight = FromView.offsetHeight;
        ToView.hidden = false;
        FocusTarget.focus( { preventScroll: true } );
        FromView.inert = true;
        if ( ReducedMotion.matches ) {
            FinishSwap( FromView, ToView );
            return;
        }
        const EndHeight = StartHeight - FromHeight + ToView.offsetHeight;
        FromView.dataset.state = 'leaving';
        ToView.dataset.state = 'entering';
        Dialog.setAttribute( 'data-morphing', '' );
        ViewMorph?.cancel( );
        ViewMorph = Dialog.animate( [
            { height: `${StartHeight}px` },
            { height: `${EndHeight}px` }
        ], {
            duration: parseFloat( Token( '--DurationSlow', '600' ) ),
            easing: Token( '--EaseSmooth', 'cubic-bezier(0.65, 0, 0.35, 1)' ),
            fill: 'forwards'
        } );
        ViewMorph.finished.then( ( ) => FinishSwap( FromView, ToView ) ).catch( ( ) => {} );
    }

    function ShowSuccess( Result ) {
        Phase = 'done';
        Completed = true;
        DownloadDetails = Result;
        ApplyValue( '' );
        SuccessMessage.textContent = Copy.Starting;
        AgainButton.hidden = false;
        SuccessPricing.hidden = true;
        Dialog.setAttribute( 'aria-labelledby', 'SuccessTitle' );
        Dialog.setAttribute( 'aria-describedby', 'SuccessMessage' );
        SwapView( FormView, SuccessView, SuccessTitle );
        StartDownload( );
    }

    async function SubmitKey( ) {
        if ( Phase !== 'idle' )
            return;
        const Key = FormatKey( Input.value );
        if ( !KeyPattern.test( Key ) ) {
            ShowMessage( Copy.Incomplete, 'error' );
            Input.focus( { preventScroll: true } );
            return;
        }
        ClearMessage( );
        SetBusy( true );
        Generation += 1;
        const Attempt = Generation;
        try {
            const Result = await Download.Start( Key );
            if ( Attempt !== Generation || !Dialog.open )
                return;
            ShowSuccess( Result );
        } catch ( Error ) {
            if ( Attempt !== Generation || !Dialog.open )
                return;
            SetBusy( false );
            ShowMessage( Error.message || Copy.Rejected, 'error' );
            Input.focus( { preventScroll: true } );
        }
    }

    function Reset( ) {
        window.clearTimeout( CloseTimer );
        window.clearTimeout( MessageTimer );
        ViewMorph?.cancel( );
        ViewMorph = null;
        Dialog.removeAttribute( 'data-state' );
        Dialog.removeAttribute( 'data-morphing' );
        Dialog.setAttribute( 'aria-labelledby', 'LicenceTitle' );
        Dialog.removeAttribute( 'aria-describedby' );
        FormView.hidden = false;
        FormView.inert = false;
        SuccessView.hidden = true;
        delete FormView.dataset.state;
        delete SuccessView.dataset.state;
        delete Form.dataset.message;
        Message.textContent = '';
        Field.removeAttribute( 'data-shake' );
        Input.setAttribute( 'aria-invalid', 'false' );
        SetBusy( false );
        DownloadDetails = null;
        ApplyValue( Completed ? '' : Input.value );
        Completed = false;
    }

    function OpenDialog( Trigger ) {
        if ( Dialog.open )
            return;
        ReturnFocus = Trigger;
        PendingLink = '';
        Reset( );
        Dialog.showModal( );
        UpdateOverflow( );
        if ( FinePointer.matches ) {
            Input.focus( { preventScroll: true } );
            Input.setSelectionRange( Input.value.length, Input.value.length );
        } else {
            FormTitle.focus( { preventScroll: true } );
        }
    }

    function FinishClose( ) {
        window.clearTimeout( CloseTimer );
        if ( Dialog.open )
            Dialog.close( );
    }

    function RequestClose( ) {
        if ( !Dialog.open || Dialog.dataset.state === 'closing' )
            return;
        Generation += 1;
        Download.Cancel( );
        ApplyValue( '' );
        if ( ReducedMotion.matches ) {
            Dialog.close( );
            return;
        }
        Dialog.dataset.state = 'closing';
        window.clearTimeout( CloseTimer );
        CloseTimer = window.setTimeout( FinishClose, 480 );
    }

    function NavigateTo( Destination ) {
        const Address = new URL( Destination, window.location.href );
        const SamePage = Address.origin === window.location.origin && Address.pathname === window.location.pathname;
        const Target = SamePage && Address.hash ? document.getElementById( decodeURIComponent( Address.hash.slice( 1 ) ) ) : null;
        if ( !Target ) {
            window.location.assign( Address.href );
            return;
        }
        history.pushState( null, '', Address.hash );
        Target.scrollIntoView( { behavior: ReducedMotion.matches ? 'auto' : 'smooth', block: 'start' } );
    }

    function OutsideDialog( Event ) {
        const Bounds = Dialog.getBoundingClientRect( );
        return Event.clientX < Bounds.left || Event.clientX > Bounds.right || Event.clientY < Bounds.top || Event.clientY > Bounds.bottom;
    }

    Input.addEventListener( 'input', ( ) => {
        ApplyValue( Input.value, Input.selectionStart ?? Input.value.length );
        ClearMessage( );
    } );

    Input.addEventListener( 'keydown', ( Event ) => {
        if ( Event.key !== 'Enter' || Event.isComposing || Phase !== 'idle' )
            return;
        if ( !KeyPattern.test( FormatKey( Input.value ) ) ) {
            Event.preventDefault( );
            ShowMessage( Copy.Incomplete, 'error' );
        }
    } );

    Input.addEventListener( 'paste', ( Event ) => {
        const Text = Event.clipboardData?.getData( 'text' ) || '';
        if ( !Text || Phase !== 'idle' )
            return;
        Event.preventDefault( );
        InsertText( Text );
        ClearMessage( );
    } );

    PasteButton.hidden = !navigator.clipboard?.readText;
    PasteButton.addEventListener( 'click', async ( ) => {
        if ( Phase !== 'idle' )
            return;
        const Attempt = Generation;
        try {
            const Text = await navigator.clipboard.readText( );
            if ( Attempt !== Generation || !Dialog.open || Phase !== 'idle' )
                return;
            if ( Significant( Text ) ) {
                ApplyValue( Text );
                ClearMessage( );
            }
        } catch {
            if ( Attempt !== Generation || !Dialog.open || Phase !== 'idle' )
                return;
            ShowMessage( FinePointer.matches ? Copy.Shortcut : Copy.Touch, 'hint' );
        }
        if ( FinePointer.matches )
            Input.focus( { preventScroll: true } );
    } );

    Field.addEventListener( 'animationend', ( Event ) => {
        if ( Event.animationName === 'KeyShake' )
            Field.removeAttribute( 'data-shake' );
    } );

    Field.addEventListener( 'pointerdown', ( Event ) => {
        if ( Event.target !== Field )
            return;
        Event.preventDefault( );
        Input.focus( { preventScroll: true } );
    } );

    Form.addEventListener( 'submit', ( Event ) => {
        Event.preventDefault( );
        SubmitKey( );
    } );

    AgainButton.addEventListener( 'click', StartDownload );

    Dialog.querySelectorAll( '[data-licence-close]' ).forEach( ( Button ) => {
        Button.addEventListener( 'click', RequestClose );
    } );

    Dialog.querySelectorAll( '[data-licence-pricing]' ).forEach( ( Link ) => {
        Link.addEventListener( 'click', ( Event ) => {
            if ( Event.metaKey || Event.ctrlKey || Event.shiftKey || Event.altKey )
                return;
            Event.preventDefault( );
            PendingLink = Link.href;
            RequestClose( );
        } );
    } );

    Dialog.addEventListener( 'cancel', ( Event ) => {
        Event.preventDefault( );
        RequestClose( );
    } );

    Dialog.addEventListener( 'pointerdown', ( Event ) => {
        PressedBackdrop = Event.target === Dialog && OutsideDialog( Event );
    } );

    Dialog.addEventListener( 'click', ( Event ) => {
        if ( PressedBackdrop && Event.target === Dialog && OutsideDialog( Event ) )
            RequestClose( );
        PressedBackdrop = false;
    } );

    Dialog.addEventListener( 'animationend', ( Event ) => {
        if ( Event.target === Dialog && Dialog.dataset.state === 'closing' )
            FinishClose( );
    } );

    Dialog.addEventListener( 'close', ( ) => {
        window.clearTimeout( CloseTimer );
        Dialog.removeAttribute( 'data-state' );
        Generation += 1;
        Download.Cancel( );
        DownloadDetails = null;
        ApplyValue( '' );
        ViewMorph?.cancel( );
        const FocusTarget = ReturnFocus;
        const Destination = PendingLink;
        ReturnFocus = null;
        PendingLink = '';
        if ( Destination ) {
            NavigateTo( Destination );
            return;
        }
        if ( FocusTarget?.isConnected )
            FocusTarget.focus( { preventScroll: true } );
    } );

    window.addEventListener( 'resize', ( ) => {
        if ( Dialog.open )
            UpdateOverflow( );
    }, { passive: true } );

    document.querySelectorAll( '[data-open-download]' ).forEach( ( Trigger ) => {
        Trigger.setAttribute( 'aria-haspopup', 'dialog' );
    } );

    document.addEventListener( 'click', ( Event ) => {
        const Trigger = Event.target instanceof Element ? Event.target.closest( '[data-open-download]' ) : null;
        if ( !Trigger )
            return;
        Event.preventDefault( );
        OpenDialog( Trigger );
    } );
} )( );
