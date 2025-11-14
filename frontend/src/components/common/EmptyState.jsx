const EmptyState = ({ title, description, action }) => (
  <div className="customer-empty animate-fade-up">
    <h3 className="customer-empty__title">{title}</h3>
    {description && <p className="customer-empty__text">{description}</p>}
    {action}
  </div>
);

export default EmptyState;

