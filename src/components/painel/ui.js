"use client";

import { useEffect, useState } from "react";
import c from "clsx";
import styles from "./Painel.module.css";

export const Field = ({ label, hint, error, children }) => (
  <label className={styles.field}>
    <span className={styles.label}>{label}</span>
    {children}
    {hint && <span className={styles.hint}>{hint}</span>}
    {error && (
      <span className={styles.fieldError}>
        {error.message || "Campo obrigatório"}
      </span>
    )}
  </label>
);

export const Alert = ({ tipo = "info", children }) =>
  children ? (
    <div className={c(styles.alert, styles[tipo])} role="status">
      {children}
    </div>
  ) : null;

// Botão de ação destrutiva: o primeiro clique pede confirmação, o segundo age.
export const ConfirmButton = ({
  children,
  confirmText = "Confirmar?",
  onConfirm,
  className,
  ...props
}) => {
  const [armado, setArmado] = useState(false);

  useEffect(() => {
    if (!armado) return;
    const timer = setTimeout(() => setArmado(false), 4000);
    return () => clearTimeout(timer);
  }, [armado]);

  return (
    <button
      type="button"
      className={c(className, armado && styles.btnDanger)}
      onClick={() =>
        armado ? (setArmado(false), onConfirm()) : setArmado(true)
      }
      {...props}
    >
      {armado ? confirmText : children}
    </button>
  );
};
