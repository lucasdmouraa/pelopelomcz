export const Vacina = ({ active, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={49}
    height={48}
    fill="none"
    {...props}
  >
    <path
      stroke={active ? "var(--secondary)" : "var(--inactive)"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={4}
      d="m36.34 2.125 9.722 9.722m-4.86-4.86L30.263 17.923m-7.292-7.292 14.584 14.583m-2.431-2.43L19.326 38.583H9.604m0 0v-9.722l15.799-15.799M9.604 38.584l-7.291 7.292m10.937-20.66 3.646 3.646m3.646-10.937 3.645 3.645"
    />
  </svg>
);
