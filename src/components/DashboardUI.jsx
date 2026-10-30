import { ArrowUpRight } from "lucide-react";

export function PanelTitle({ icon: Icon, label, title, onOpen }) {
  return (
    <div className="panel-title">
      <div className="panel-eyebrow">
        <span className="dashboard-icon">
          <Icon size={19} />
        </span>
        <span>{label}</span>
        {onOpen && (
          <button className="icon-button" aria-label={title} onClick={onOpen}>
            <ArrowUpRight size={18} />
          </button>
        )}
      </div>
      <h2>{title}</h2>
    </div>
  );
}

export function StatCard({
  title,
  value,
  note,
  icon: Icon,
  accent = false,
  onClick,
  active,
}) {
  const Tag = onClick ? "button" : "section";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={`card dashboard-stat ${accent ? "accent" : ""}`}
    >
      <div>
        <span>{title}</span>
        <span className="dashboard-icon">
          <Icon size={21} />
        </span>
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </Tag>
  );
}
