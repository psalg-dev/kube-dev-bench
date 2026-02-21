import './Button.css';

export default function Button({
  variant = 'default',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`ui-button ui-button-${variant} ui-button-${size} ${className}`.trim()}
      {...props}
    />
  );
}
