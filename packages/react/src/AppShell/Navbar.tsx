import { Button, AppShell as MantineAppShell, ScrollArea, Space, Text, Tooltip } from '@mantine/core';
import { useMedplumNavigate } from '@medplum/react-hooks';
import { IconPlus } from '@tabler/icons-react';
import cx from 'clsx';
import { Fragment, JSX, MouseEventHandler, SyntheticEvent, useState } from 'react';
import { BookmarkDialog } from '../BookmarkDialog/BookmarkDialog';
import { ResourceTypeInput } from '../ResourceTypeInput/ResourceTypeInput';
import classes from './Navbar.module.css';

const DEFAULT_WIDTH = 300;

export interface NavbarLink {
  readonly icon?: JSX.Element;
  readonly label?: string;
  readonly href: string;
}

export interface NavbarMenu {
  readonly title?: string;
  readonly links?: NavbarLink[];
}

export interface NavbarProps {
  readonly pathname?: string;
  readonly searchParams?: URLSearchParams;
  readonly menus?: NavbarMenu[];
  readonly closeNavbar: () => void;
  readonly displayAddBookmark?: boolean;
  readonly resourceTypeSearchDisabled?: boolean;
  readonly opened?: boolean;
  readonly width?: number;
}

export function Navbar(props: NavbarProps): JSX.Element {
  const navigate = useMedplumNavigate();
  const activeLink = getActiveLink(props.pathname, props.searchParams, props.menus);
  const [bookmarkDialogVisible, setBookmarkDialogVisible] = useState(false);

  function onLinkClick(e: SyntheticEvent, to: string): void {
    e.stopPropagation();
    e.preventDefault();
    navigate(to);
    if (window.innerWidth < 768) {
      props.closeNavbar();
    }
  }

  function navigateResourceType(resourceType: string | undefined): void {
    if (resourceType) {
      navigate(`/${resourceType}`);
    }
  }

  const opened = props.opened ?? true;
  const width = props.width ?? DEFAULT_WIDTH;

  return (
    <>
      <MantineAppShell.Navbar
        p={0}
        style={{
          transitionProperty: 'width',
        }}
      >
        <ScrollArea p="xs" pr="md">
          {!props.resourceTypeSearchDisabled &&
            (opened ? (
              <MantineAppShell.Section mb="sm">
                <ResourceTypeInput
                  key={window.location.pathname}
                  name="resourceType"
                  placeholder="Resource Type"
                  maxValues={0}
                  onChange={(newValue) => navigateResourceType(newValue)}
                />
              </MantineAppShell.Section>
            ) : (
              <Space h="lg" />
            ))}
          <MantineAppShell.Section grow>
            {props.menus?.map((menu) => (
              <Fragment key={`menu-${menu.title}`}>
                {opened ? <Text className={classes.menuTitle}>{menu.title}</Text> : <Space h="lg" />}
                {menu.links?.map((link) => (
                  <NavbarLink
                    key={link.href}
                    to={link.href}
                    active={link.href === activeLink?.href}
                    onClick={(e) => onLinkClick(e, link.href)}
                    icon={link.icon}
                    label={link.label ?? ''}
                    opened={opened}
                    width={width}
                  />
                ))}
              </Fragment>
            ))}
            {props.displayAddBookmark && (
              <Button
                variant="subtle"
                size="xs"
                mt="xl"
                leftSection={<IconPlus size="0.75rem" />}
                onClick={() => setBookmarkDialogVisible(true)}
              >
                Add Bookmark
              </Button>
            )}
          </MantineAppShell.Section>
        </ScrollArea>
      </MantineAppShell.Navbar>
      {props.pathname && props.searchParams && (
        <BookmarkDialog
          pathname={props.pathname}
          searchParams={props.searchParams}
          visible={bookmarkDialogVisible}
          onOk={() => setBookmarkDialogVisible(false)}
          onCancel={() => setBookmarkDialogVisible(false)}
        />
      )}
    </>
  );
}

interface NavbarLinkProps {
  readonly to: string;
  readonly active: boolean;
  readonly onClick: MouseEventHandler;
  readonly icon?: JSX.Element;
  readonly label: string;
  readonly opened?: boolean;
  readonly width: number;
}

function NavbarLink(props: NavbarLinkProps): JSX.Element {
  const opened = props.opened ?? true;
  return (
    <a
      className={cx(classes.link, { [classes.linkActive]: props.active })}
      style={{
        width: props.width - 36,
        transitionProperty: 'all',
        transitionDuration: '0.2s',
        textOverflow: 'ellipsis',
      }}
      data-active={props.active}
      href={props.to}
      key={props.to}
      onClick={(e) => {
        e.preventDefault();
        props.onClick(e);
      }}
    >
      <Tooltip label={props.label}>
        <div
          style={{
            width: 32,
            height: 18,
            padding: 0,
            margin: '0 8 0 0',
          }}
        >
          {props.icon}
        </div>
      </Tooltip>
      {opened && <span>{props.label}</span>}
    </a>
  );
}

/**
 * Returns the best "active" link for the menu.
 * In most cases, the navbar links are simple, and an exact match can determine which link is active.
 * However, we ignore some search parameters to support pagination.
 * But we cannot ignore all search parameters, to support separate links based on search filters.
 * So in the end, we use a simple scoring system based on the number of matching query search params.
 * @param currentPathname - The web browser current pathname.
 * @param currentSearchParams - The web browser current search parameters.
 * @param menus - Collection of navbar menus and links.
 * @returns The active link if one is found.
 */
function getActiveLink(
  currentPathname: string | undefined,
  currentSearchParams: URLSearchParams | undefined,
  menus: NavbarMenu[] | undefined
): NavbarLink | undefined {
  if (!currentPathname || !currentSearchParams || !menus) {
    return undefined;
  }

  let bestLink = undefined;
  let bestScore = 0;

  for (const menu of menus) {
    if (menu.links) {
      for (const link of menu.links) {
        const score = getLinkScore(currentPathname, currentSearchParams, link.href);
        if (score > bestScore) {
          bestScore = score;
          bestLink = link;
        }
      }
    }
  }

  return bestLink;
}

/**
 * Calculates a score for a link.
 * Zero means "does not match at all".
 * One means "matches the pathname only".
 * Additional increases for each matching search parameter.
 * Ignores pagination parameters "_count" and "_offset".
 * @param currentPathname - The web browser current pathname.
 * @param currentSearchParams - The web browser current search parameters.
 * @param linkHref - A candidate link href.
 * @returns The link score.
 */
function getLinkScore(currentPathname: string, currentSearchParams: URLSearchParams, linkHref: string): number {
  const linkUrl = new URL(linkHref, 'https://example.com');
  if (currentPathname !== linkUrl.pathname) {
    return 0;
  }
  const ignoredParams = ['_count', '_offset'];
  for (const [key, value] of linkUrl.searchParams.entries()) {
    if (ignoredParams.includes(key)) {
      continue;
    }
    if (currentSearchParams.get(key) !== value) {
      return 0;
    }
  }
  let count = 1;
  for (const [key, value] of currentSearchParams.entries()) {
    if (ignoredParams.includes(key)) {
      continue;
    }
    if (linkUrl.searchParams.get(key) === value) {
      count++;
    }
  }
  return count;
}
