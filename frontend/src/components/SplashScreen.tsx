export default function SplashScreen() {
  return (
    <div className="splash-screen" role="status" aria-label="Loading WannaTalk">
      <img src="/assets/logo-transparent.png" alt="WannaTalk" className="splash-logo" />
      <div className="splash-loader" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p>Loading WannaTalk…</p>
    </div>
  );
}
