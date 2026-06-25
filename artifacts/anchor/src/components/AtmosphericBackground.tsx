/**
 * Atmospheric background with subtle radial gradient glows.
 * Gives the app a premium, calm depth without illustrations.
 */
export function AtmosphericBackground() {
  return (
    <>
      {/* Base warm espresso */}
      <div className="fixed inset-0 -z-10 bg-[#0D0C0B]" />
      {/* Radial glows — warm amber, teal, purple */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: `
            radial-gradient(circle at 20% 10%, rgba(120,80,50,0.18), transparent 35%),
            radial-gradient(circle at 80% 0%, rgba(45,120,100,0.14), transparent 30%),
            radial-gradient(circle at 50% 100%, rgba(90,70,140,0.12), transparent 35%)
          `,
        }}
      />
      {/* Subtle top highlight */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: "linear-gradient(to bottom, rgba(255,255,255,0.03), transparent 30%)",
        }}
      />
    </>
  );
}
