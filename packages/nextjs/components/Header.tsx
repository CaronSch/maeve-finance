"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hardhat } from "viem/chains";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useOutsideClick, useTargetNetwork } from "~~/hooks/scaffold-eth";

type HeaderMenuLink = {
  label: string;
  href: string;
};

export const menuLinks: HeaderMenuLink[] = [
  { label: "Dashboard", href: "/" },
  { label: "Lend", href: "/lend" },
  { label: "Borrow", href: "/borrow" },
  { label: "Scores", href: "/scores" },
  { label: "Debug", href: "/debug" },
];

export const HeaderMenuLinks = () => {
  const pathname = usePathname();

  return (
    <>
      {menuLinks.map(({ label, href }) => {
        const isActive = pathname === href;
        return (
          <li key={href}>
            <Link
              href={href}
              passHref
              className={`${
                isActive ? "text-primary" : "text-base-content/60 hover:text-base-content"
              } font-mono text-xs uppercase tracking-[0.2em] py-1.5 px-3 rounded-md`}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </>
  );
};

export const Header = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  const burgerMenuRef = useRef<HTMLDetailsElement>(null);
  useOutsideClick(burgerMenuRef, () => {
    burgerMenuRef?.current?.removeAttribute("open");
  });

  return (
    <div
      className="sticky lg:static top-0 navbar bg-base-100 min-h-0 shrink-0 justify-between z-20 px-0 sm:px-2"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="navbar-start w-auto lg:w-1/2">
        <details className="dropdown" ref={burgerMenuRef}>
          <summary className="ml-1 btn btn-ghost lg:hidden hover:bg-transparent">
            <Bars3Icon className="h-1/2" />
          </summary>
          <ul
            className="menu menu-compact dropdown-content mt-3 p-2 bg-base-100 rounded-box w-52"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            onClick={() => {
              burgerMenuRef?.current?.removeAttribute("open");
            }}
          >
            <HeaderMenuLinks />
          </ul>
        </details>
        <Link href="/" passHref className="hidden lg:flex items-center ml-4 mr-10 shrink-0">
          <span className="font-mono font-semibold text-base tracking-[0.4em] text-primary">MAEVE</span>
          <span
            className="font-mono text-[10px] tracking-[0.3em] uppercase text-base-content/30 ml-3 pl-3"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }}
          >
            v0
          </span>
        </Link>
        <ul className="hidden lg:flex lg:flex-nowrap menu menu-horizontal px-1 gap-1">
          <HeaderMenuLinks />
        </ul>
      </div>
      <div className="navbar-end grow mr-4 gap-2">
        <RainbowKitCustomConnectButton />
        {isLocalNetwork && <FaucetButton />}
      </div>
    </div>
  );
};
