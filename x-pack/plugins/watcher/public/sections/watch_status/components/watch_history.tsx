/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React, { Fragment, useState, useContext } from 'react';
import { i18n } from '@kbn/i18n';
import { FormattedMessage, injectI18n } from '@kbn/i18n/react';
import { Moment } from 'moment';

import { toastNotifications } from 'ui/notify';
import {
  EuiButton,
  EuiCodeBlock,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutHeader,
  EuiInMemoryTable,
  EuiLink,
  EuiSelect,
  EuiSpacer,
  EuiTitle,
} from '@elastic/eui';

import { PAGINATION } from '../../../../common/constants';
import { goToWatchList } from '../../../lib/navigation';
import { WatchStatus, DeleteWatchesModal, SectionError } from '../../../components';
import {
  activateWatch,
  deactivateWatch,
  loadWatchHistory,
  loadWatchHistoryDetail,
} from '../../../lib/api';
import { WatchDetailsContext } from '../watch_details_context';

const watchHistoryTimeSpanOptions = [
  {
    value: 'now-1h',
    text: i18n.translate('xpack.watcher.sections.watchHistory.timeSpan.1h', {
      defaultMessage: 'Last one hour',
    }),
  },
  {
    value: 'now-24h',
    text: i18n.translate('xpack.watcher.sections.watchHistory.timeSpan.24h', {
      defaultMessage: 'Last 24 hours',
    }),
  },
  {
    value: 'now-7d',
    text: i18n.translate('xpack.watcher.sections.watchHistory.timeSpan.7d', {
      defaultMessage: 'Last 7 days',
    }),
  },
  {
    value: 'now-30d',
    text: i18n.translate('xpack.watcher.sections.watchHistory.timeSpan.30d', {
      defaultMessage: 'Last 30 days',
    }),
  },
  {
    value: 'now-6M',
    text: i18n.translate('xpack.watcher.sections.watchHistory.timeSpan.6M', {
      defaultMessage: 'Last 6 months',
    }),
  },
  {
    value: 'now-1y',
    text: i18n.translate('xpack.watcher.sections.watchHistory.timeSpan.1y', {
      defaultMessage: 'Last 1 year',
    }),
  },
];

const WatchHistoryUi = () => {
  const { watchDetail: loadedWatch } = useContext(WatchDetailsContext);

  const [isActivated, setIsActivated] = useState<boolean | undefined>(undefined);
  const [detailWatchId, setDetailWatchId] = useState<string | undefined>(undefined);
  const [watchesToDelete, setWatchesToDelete] = useState<string[]>([]);
  const [isTogglingActivation, setIsTogglingActivation] = useState<boolean>(false);

  const [watchHistoryTimeSpan, setWatchHistoryTimeSpan] = useState<string>(
    watchHistoryTimeSpanOptions[0].value
  );

  if (isActivated === undefined) {
    // Set initial value for isActivated based on the watch we just loaded.
    setIsActivated(loadedWatch.watchStatus.isActive);
  }

  const { error: historyError, data: history, isLoading } = loadWatchHistory(
    loadedWatch.id,
    watchHistoryTimeSpan
  );

  const { error: watchHistoryDetailsError, data: watchHistoryDetails } = loadWatchHistoryDetail(
    detailWatchId
  );

  const executionDetail = watchHistoryDetails
    ? JSON.stringify(watchHistoryDetails.details, null, 2)
    : '';

  const historySectionTitle = (
    <EuiTitle size="s">
      <h2>
        <FormattedMessage
          id="xpack.watcher.sections.watchHistory.header"
          defaultMessage="Execution history"
        />
      </h2>
    </EuiTitle>
  );

  if (historyError) {
    return (
      <Fragment>
        {historySectionTitle}
        <EuiSpacer size="s" />
        <SectionError
          title={
            <FormattedMessage
              id="xpack.watcher.sections.watchHistory.watchExecutionErrorTitle"
              defaultMessage="Error loading execution history"
            />
          }
          error={historyError}
        />
      </Fragment>
    );
  }
  const columns = [
    {
      field: 'startTime',
      name: i18n.translate('xpack.watcher.sections.watchHistory.watchTable.startTimeHeader', {
        defaultMessage: 'Trigger time',
      }),
      sortable: true,
      truncateText: true,
      render: (startTime: Moment, item: any) => {
        const formattedDate = startTime.format();
        return (
          <EuiLink
            className="indTable__link euiTableCellContent"
            data-test-subj={`watchIdColumn-${formattedDate}`}
            onClick={() => setDetailWatchId(item.id)}
          >
            {formattedDate}
          </EuiLink>
        );
      },
    },
    {
      field: 'watchStatus.state',
      name: i18n.translate('xpack.watcher.sections.watchHistory.watchTable.stateHeader', {
        defaultMessage: 'State',
      }),
      sortable: true,
      truncateText: true,
      render: (state: string) => <WatchStatus status={state} />,
    },
    {
      field: 'watchStatus.comment',
      name: i18n.translate('xpack.watcher.sections.watchHistory.watchTable.commentHeader', {
        defaultMessage: 'Comment',
      }),
      sortable: true,
      truncateText: true,
    },
  ];

  const onTimespanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const timespan = e.target.value;
    setWatchHistoryTimeSpan(timespan);
  };

  const toggleWatchActivation = async () => {
    const toggleActivation = isActivated ? deactivateWatch : activateWatch;

    setIsTogglingActivation(true);

    const { error } = await toggleActivation(loadedWatch.id);

    setIsTogglingActivation(false);

    if (error) {
      const message = isActivated
        ? i18n.translate(
            'xpack.watcher.sections.watchList.toggleActivatationErrorNotification.deactivateDescriptionText',
            {
              defaultMessage: "Couldn't deactivate watch",
            }
          )
        : i18n.translate(
            'xpack.watcher.sections.watchList.toggleActivatationErrorNotification.activateDescriptionText',
            {
              defaultMessage: "Couldn't activate watch",
            }
          );
      return toastNotifications.addDanger(message);
    }

    setIsActivated(!isActivated);
  };

  let flyout;

  if (detailWatchId !== undefined) {
    if (watchHistoryDetailsError) {
      flyout = (
        <EuiFlyout
          data-test-subj="watchHistoryErrorDetailFlyout"
          onClose={() => setDetailWatchId(undefined)}
          aria-labelledby="watchHistoryErrorDetailsFlyoutTitle"
          maxWidth={600}
        >
          <EuiFlyoutHeader>
            <EuiTitle size="s">
              <h3>
                <FormattedMessage
                  id="xpack.watcher.sections.watchHistory.watchHistoryDetail.errorTitle"
                  defaultMessage="Execution details"
                />
              </h3>
            </EuiTitle>
          </EuiFlyoutHeader>

          <EuiFlyoutBody>
            <SectionError
              title={
                <FormattedMessage
                  id="xpack.watcher.sections.watchHistory.watchHistoryDetailsErrorTitle"
                  defaultMessage="Error loading execution details"
                />
              }
              error={watchHistoryDetailsError}
            />
          </EuiFlyoutBody>
        </EuiFlyout>
      );
    }
    if (watchHistoryDetails !== undefined) {
      const detailColumns = [
        {
          field: 'id',
          name: i18n.translate('xpack.watcher.sections.watchHistory.watchActionStatusTable.id', {
            defaultMessage: 'Name',
          }),
          sortable: true,
          truncateText: true,
        },
        {
          field: 'state',
          name: i18n.translate('xpack.watcher.sections.watchHistory.watchActionStatusTable.state', {
            defaultMessage: 'State',
          }),
          sortable: true,
          truncateText: true,
          render: (state: string) => <WatchStatus status={state} />,
        },
      ];

      flyout = (
        <EuiFlyout
          data-test-subj="watchHistoryDetailFlyout"
          onClose={() => setDetailWatchId(undefined)}
          aria-labelledby="watchHistoryDetailsFlyoutTitle"
          maxWidth={600}
        >
          <EuiFlyoutHeader>
            <EuiTitle size="s">
              <h3>
                <FormattedMessage
                  id="xpack.watcher.sections.watchHistory.watchHistoryDetail.title"
                  defaultMessage="Executed on {date}"
                  values={{ date: watchHistoryDetails.startTime }}
                />
              </h3>
            </EuiTitle>
          </EuiFlyoutHeader>

          <EuiFlyoutBody>
            <EuiTitle size="xs">
              <h4>
                <FormattedMessage
                  id="xpack.watcher.sections.watchHistory.watchHistoryDetail.actionsTitle"
                  defaultMessage="Actions"
                />
              </h4>
            </EuiTitle>
            <EuiInMemoryTable
              items={(watchHistoryDetails.watchStatus as any).actionStatuses}
              itemId="id"
              columns={detailColumns}
              message={
                <FormattedMessage
                  id="xpack.watcher.sections.watchHistory.watchTable.noWatchesMessage"
                  defaultMessage="No current status to show"
                />
              }
            />
            <EuiSpacer />
            <EuiTitle size="xs">
              <h4>
                <FormattedMessage
                  id="xpack.watcher.sections.watchHistory.watchHistoryDetail.jsonTitle"
                  defaultMessage="JSON"
                />
              </h4>
            </EuiTitle>
            <EuiSpacer size="s" />
            <EuiCodeBlock language="json">{executionDetail}</EuiCodeBlock>}
          </EuiFlyoutBody>
        </EuiFlyout>
      );
    }
  }

  const activationButtonText = isActivated ? (
    <FormattedMessage
      id="xpack.watcher.sections.watchHistory.watchTable.deactivateWatchLabel"
      defaultMessage="Deactivate watch"
    />
  ) : (
    <FormattedMessage
      id="xpack.watcher.sections.watchHistory.watchTable.activateWatchLabel"
      defaultMessage="Activate watch"
    />
  );

  return (
    <Fragment>
      <DeleteWatchesModal
        callback={(deleted?: string[]) => {
          if (deleted) {
            goToWatchList();
          }
          setWatchesToDelete([]);
        }}
        watchesToDelete={watchesToDelete}
      />
      <EuiFlexGroup gutterSize="s" justifyContent="spaceBetween" alignItems="center">
        <EuiFlexItem grow={false}>{historySectionTitle}</EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiFlexGroup>
            <EuiFlexItem grow={false}>
              <EuiSelect
                options={watchHistoryTimeSpanOptions}
                value={watchHistoryTimeSpan}
                onChange={onTimespanChange}
                aria-label={i18n.translate(
                  'xpack.watcher.sections.watchHistory.changeTimespanSelectAriaLabel',
                  {
                    defaultMessage: 'Change timespan of watch history',
                  }
                )}
              />
            </EuiFlexItem>
            {!loadedWatch.isSystemWatch && (
              <Fragment>
                <EuiFlexItem grow={false}>
                  <EuiButton
                    onClick={() => toggleWatchActivation()}
                    isLoading={isTogglingActivation}
                  >
                    {activationButtonText}
                  </EuiButton>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiButton
                    data-test-subj="btnDeleteWatch"
                    onClick={() => {
                      setWatchesToDelete([loadedWatch.id]);
                    }}
                    color="danger"
                    disabled={false}
                  >
                    <FormattedMessage
                      id="xpack.watcher.sections.watchHistory.deleteWatchButtonLabel"
                      defaultMessage="Delete"
                    />
                  </EuiButton>
                </EuiFlexItem>
              </Fragment>
            )}
          </EuiFlexGroup>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="s" />

      <EuiInMemoryTable
        items={history}
        columns={columns}
        pagination={PAGINATION}
        sorting={true}
        loading={isLoading}
        message={
          <FormattedMessage
            id="xpack.watcher.sections.watchHistory.watchTable.noCurrentStatus"
            defaultMessage="No execution history to show"
          />
        }
      />
      {flyout}
    </Fragment>
  );
};

export const WatchHistory = injectI18n(WatchHistoryUi);
