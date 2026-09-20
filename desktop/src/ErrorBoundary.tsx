import { Component, type ErrorInfo, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";

type Props = { children: ReactNode };
type State = {
  hasError: boolean;
  reportMessage: string;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, reportMessage: "" };

  static getDerivedStateFromError(): State {
    return { hasError: true, reportMessage: "" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[LLinen Earth OS] desktop UI crash", error, info.componentStack);
  }

  private exportReport = async () => {
    this.setState({ reportMessage: "Creating local system report…" });
    try {
      const path = await invoke<string>("export_system_report");
      this.setState({ reportMessage: `System report saved: ${path}` });
    } catch (error) {
      this.setState({ reportMessage: `Could not create report: ${String(error)}` });
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="desktopRecoveryScreen">
        <section className="desktopRecoveryPanel">
          <div className="desktopLockBrand">
            <span>LE</span>
            <div><b>LLINEN EARTH</b><small>OPERATOR SYSTEM</small></div>
          </div>
          <small className="desktopRecoveryEyebrow">INTERFACE RECOVERY</small>
          <h1>The window hit an unexpected error.</h1>
          <p>
            Your local LLinen Earth vault has not been deleted. Restart the interface first.
            If the issue repeats, export a system report before closing the app.
          </p>
          <div className="desktopRecoveryActions">
            <button onClick={() => window.location.reload()}>Restart interface ↻</button>
            <button onClick={() => void this.exportReport()}>Export system report ↗</button>
          </div>
          {this.state.reportMessage && <code>{this.state.reportMessage}</code>}
          <footer>Local-first recovery · No customer data is sent automatically.</footer>
        </section>
      </main>
    );
  }
}
