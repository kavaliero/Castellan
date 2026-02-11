import "./alerts.css";

/**
 * Le popup visuel d'une alerte.
 * 
 * Le `key` dans AlertsPage force React à RE-CRÉER le composant
 * à chaque nouvelle alerte (pas juste mettre à jour). Ça relance
 * l'animation CSS d'entrée à chaque fois.
 */

interface AlertPopupProps {
    alert: {
        type: string;
        icon: string;
        title: string;
        message: string;
    };
}

export function AlertPopup({ alert }: AlertPopupProps) {
    return (
        <div className={`alert-popup alert-${alert.type}`}>
            <div className="alert-icon">{alert.icon}</div>
            <div className="alert-text">
                <div className="alert-title">{alert.title}</div>
                <div className="alert-message">{alert.message}</div>
            </div>
        </div>
    );
}