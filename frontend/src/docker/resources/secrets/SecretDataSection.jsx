import EmptyTabContent from '../../../components/EmptyTabContent';

/**
 * Docker Swarm secrets cannot be read back once created - this is a security feature.
 * The secret data is encrypted and only accessible inside containers.
 * This component displays an informative message about this limitation.
 */
export default function SecretDataSection() {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          fontWeight: 600,
          color: 'var(--gh-text, #c9d1d9)',
          padding: '12px 16px 8px',
          borderBottom: '1px solid var(--gh-border, #30363d)',
        }}
      >
        Secret Data
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <EmptyTabContent
          icon="🔒"
          title="Secret data is encrypted"
          description="Docker Swarm secrets cannot be read back once created. This is a security feature - secret data is only accessible inside running containers."
          tip="To view or modify the secret content, use the Edit or Rotate buttons above."
        />
      </div>
    </div>
  );
}
