import "./LoadingScreen.css";

function LoadingScreen({ title = "Loading...", subtitle = "Please wait..." }) {
  return (
    <div className="app-loading-screen" role="status" aria-live="polite">
      <div className="app-loading-spinner"></div>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}

export default LoadingScreen;
