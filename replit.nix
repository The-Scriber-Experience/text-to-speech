{pkgs}: {
  deps = [
    pkgs.run
    pkgs.openssh
    pkgs.postgresql
    pkgs.openssl
  ];
}
