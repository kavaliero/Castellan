import "./alerts.css";

/**
 * Parchemin Scelle — alerte en forme de parchemin medieval.
 *
 * Le composant est purement presentationnel. Toute l'animation
 * est geree en CSS via les keyframes dans alerts.css.
 * Le `key` dans AlertsPage force le re-montage a chaque alerte,
 * ce qui relance toute la sequence d'animation.
 */

export type ScrollAlertType =
    | 'follow' | 'sub' | 'resub' | 'gift_sub'
    | 'raid' | 'bits' | 'hype_train' | 'first_word' | 'dice';

export type ScrollAlertVariant = 'minor' | 'major';

export interface ScrollAlertData {
    type: ScrollAlertType;
    variant: ScrollAlertVariant;
    icon: string;
    title: string;
    viewerName: string;
    subtitle?: string;
    ribbon?: string;
}

interface ScrollAlertProps {
    alert: ScrollAlertData;
}

export function ScrollAlert({ alert }: ScrollAlertProps) {
    const wrapperClass = [
        'scroll-alert',
        `scroll-alert--${alert.type}`,
        `scroll-alert--${alert.variant}`,
    ].join(' ');

    return (
        <div className={wrapperClass}>
            {/* Sceau de cire */}
            <div className="scroll-seal">
                <div className="scroll-seal-half--left" />
                <div className="scroll-seal-half--right" />
                <div className="scroll-seal-crack" />
                <div className="scroll-seal-icon">{alert.icon}</div>
                <div className="scroll-seal-burst" />
            </div>

            {/* Corps du parchemin */}
            <div className="scroll-parchment">
                {/* Bord roule haut */}
                <div className="scroll-roll" />

                {/* Contenu (se deroule via max-height) */}
                <div className="scroll-content">
                    <div className="scroll-content-inner">
                        <div className="scroll-title">{alert.title}</div>
                        <div className="scroll-separator" />
                        <div className="scroll-viewer-name">{alert.viewerName}</div>
                        {alert.subtitle && (
                            <div className="scroll-subtitle">{alert.subtitle}</div>
                        )}
                        {alert.ribbon && (
                            <div className="scroll-ribbon">{alert.ribbon}</div>
                        )}
                    </div>
                </div>

                {/* Bord roule bas */}
                <div className="scroll-roll" />
            </div>
        </div>
    );
}
