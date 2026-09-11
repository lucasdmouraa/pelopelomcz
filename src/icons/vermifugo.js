export const Vermifugo = ({ active, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={26}
    height={44}
    fill="none"
    {...props}
  >
    <path
      stroke={active ? "var(--secondary)" : "var(--inactive)"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={4}
      d="M17.375 8.875a2.187 2.187 0 0 0 2.188-2.188V4.5a2.188 2.188 0 0 0-2.188-2.188h-8.75A2.188 2.188 0 0 0 6.437 4.5v2.188a2.188 2.188 0 0 0 2.188 2.187m8.75 0h-8.75m8.75 0v2.144a3.927 3.927 0 0 0 3.281 3.872 3.925 3.925 0 0 1 3.282 3.871v18.55a4.375 4.375 0 0 1-4.375 4.376H6.438a4.375 4.375 0 0 1-4.375-4.376v-18.55a3.925 3.925 0 0 1 3.28-3.871 3.925 3.925 0 0 0 3.282-3.872V8.875M2.062 22h21.875M2.063 35.125h21.875m-13.125-6.563h4.376"
    />
  </svg>
);
