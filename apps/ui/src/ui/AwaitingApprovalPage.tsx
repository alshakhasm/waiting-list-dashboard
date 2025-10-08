export function AwaitingApprovalPage() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh', padding: 24 }}>
      <div style={{ maxWidth: 520 }}>
        <h1>Awaiting approval</h1>
        <p>Your account is pending approval by the owner. You will be able to access data once approved.</p>
      </div>
    </div>
  );
}
