export function WindowsPermissionsNote() {
  return (
    <details className="support-note">
      <summary>Quando o Windows pedir usuário e senha</summary>
      <p>
        Ao abrir um programa como administrador no PC atendido, confirme a elevação no Windows
        dentro do ISL Light. Se necessário, habilite o Modo Administrativo do ISL e informe a conta
        autorizada no próprio prompt.
      </p>
      <p>
        A senha da conta Windows é diferente da senha de acesso do computador no ISL AlwaysOn. Não
        use uma no campo da outra.
      </p>
      <p>
        A consulta ao servidor de impressão permite uma conta Windows temporária. Isso não eleva a
        sessão remota. O Execute do AlwaysOn, quando homologado e habilitado, roda como SYSTEM.
      </p>
    </details>
  );
}
