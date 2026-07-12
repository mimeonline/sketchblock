"use client";

import { FolderGit2, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RepositoryRecord } from "@/types/sketchblock";

type RepositorySwitcherProps = {
  repositories: RepositoryRecord[];
  activeRepository: RepositoryRecord | null;
  switching: boolean;
  onSwitch: (repositoryId: string) => void;
};

export function RepositorySwitcher({
  repositories,
  activeRepository,
  switching,
  onSwitch,
}: RepositorySwitcherProps) {
  const t = useTranslations("Common");
  if (repositories.length === 0 || !activeRepository) {
    return null;
  }

  const items = repositories.map((repository) => ({
    label: `${repository.owner}/${repository.name}`,
    value: repository.id,
  }));

  return (
    <Select
      items={items}
      value={activeRepository.id}
      onValueChange={(value) => value && value !== activeRepository.id && onSwitch(value)}
      disabled={switching}
    >
      <SelectTrigger
        size="default"
        className="h-9 max-w-[250px] rounded-full bg-background/80 px-3"
        aria-label={t("switchRepository")}
      >
        {switching ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FolderGit2 aria-hidden="true" />}
        <SelectValue placeholder={t("chooseRepository")} />
      </SelectTrigger>
      <SelectContent align="end" alignItemWithTrigger={false}>
        <SelectGroup>
          <SelectLabel>{t("workspaceRepository")}</SelectLabel>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
