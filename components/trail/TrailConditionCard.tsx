import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants';
import {
  getUpvoteState,
  useTrailConditions,
  type TrailConditionWithUser,
  type UpvoteState,
} from '../../hooks/useTrailConditions';

// ─── Constants ─────────────────────────────────────────────

const CONDITION_LABELS: Record<string, { emoji: string; label: string }> = {
  trail_open: { emoji: '✅', label: 'Weg offen' },
  snow_fields: { emoji: '❄️', label: 'Schneefelder' },
  wet_slippery: { emoji: '💧', label: 'Nass/Rutschig' },
  rockfall_danger: { emoji: '⚠️', label: 'Steinschlag' },
  partially_closed: { emoji: '🚫', label: 'Teilweise gesperrt' },
  bridge_damaged: { emoji: '🌉', label: 'Brücke beschädigt' },
};

// ─── Helpers ───────────────────────────────────────────────

function getRelativeTime(isoDate: string): string {
  const now = new Date();
  const reported = new Date(isoDate);
  const diffMs = now.getTime() - reported.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  if (diffDays === 1) return 'vor 1 Tag';
  return `vor ${diffDays} Tagen`;
}

function getActiveConditions(
  conditions: Record<string, unknown> | null,
): string[] {
  if (!conditions) return [];
  return Object.entries(conditions)
    .filter(([, value]) => value === true)
    .map(([key]) => key);
}

// ─── Props ─────────────────────────────────────────────────

interface TrailConditionCardProps {
  routeId: string;
  onOpenReport: () => void;
  refreshKey?: number;
}

// ─── Component ─────────────────────────────────────────

export default function TrailConditionCard({
  routeId,
  onOpenReport,
  refreshKey,
}: TrailConditionCardProps) {
  const {
    recentConditions,
    outdatedConditions,
    isLoading,
    error,
    upvote,
    votedIds,
    upvotingId,
    userId,
    refreshConditions,
  } = useTrailConditions(routeId);

  const renderReport = (item: TrailConditionWithUser, isOutdated: boolean) => (
    <ConditionReportItem
      report={item}
      isOutdated={isOutdated}
      upvoteState={getUpvoteState(item, userId, votedIds)}
      isUpvoting={upvotingId === item.id}
      onUpvote={() => upvote(item.id)}
    />
  );

  // Refresh when refreshKey changes (e.g. after submitting a report)
  useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      refreshConditions();
    }
  }, [refreshKey, refreshConditions]);

  const latestCondition = recentConditions[0] ?? outdatedConditions[0] ?? null;

  if (isLoading && recentConditions.length === 0 && outdatedConditions.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🥾 Wegzustand</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Berichte werden geladen…</Text>
        </View>
      </View>
    );
  }

  if (error && recentConditions.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🥾 Wegzustand</Text>
        </View>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🥾 Wegzustand</Text>
        {latestCondition && (
          <View style={styles.lastReportBadge}>
            <Text style={styles.lastReportText}>
              Letzter Bericht: {getRelativeTime(latestCondition.reported_at)}
            </Text>
          </View>
        )}
      </View>

      {/* No reports */}
      {recentConditions.length === 0 && outdatedConditions.length === 0 && (
        <Text style={styles.emptyText}>
          Noch keine Berichte vorhanden. Sei der Erste!
        </Text>
      )}

      {/* Recent reports */}
      {recentConditions.length > 0 && (
        <FlatList
          data={recentConditions}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => renderReport(item, false)}
        />
      )}

      {/* Outdated reports */}
      {outdatedConditions.length > 0 && (
        <View style={styles.outdatedSection}>
          <Text style={styles.outdatedHeader}>Ältere Berichte</Text>
          <FlatList
            data={outdatedConditions}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => renderReport(item, true)}
          />
        </View>
      )}

      {/* Report button */}
      <TouchableOpacity
        style={styles.reportButton}
        onPress={onOpenReport}
        activeOpacity={0.7}
      >
        <Ionicons name="add-circle-outline" size={20} color={Colors.textOnPrimary} />
        <Text style={styles.reportButtonText}>Wegzustand melden</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Report Item ───────────────────────────────────────────

interface ConditionReportItemProps {
  report: TrailConditionWithUser;
  isOutdated: boolean;
  upvoteState: UpvoteState;
  isUpvoting: boolean;
  onUpvote: () => void;
}

function ConditionReportItem({
  report,
  isOutdated,
  upvoteState,
  isUpvoting,
  onUpvote,
}: ConditionReportItemProps) {
  const activeConditions = getActiveConditions(report.conditions);

  return (
    <View style={[styles.reportItem, isOutdated && styles.reportItemOutdated]}>
      {/* User info row */}
      <View style={styles.reportHeader}>
        <View style={styles.userInfo}>
          {report.user?.avatar_url ? (
            <Image
              source={{ uri: report.user.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={14} color={Colors.textSecondary} />
            </View>
          )}
          <Text style={styles.username}>
            {report.user?.username ?? 'Anonym'}
          </Text>
          <Text style={styles.reportDate}>
            {getRelativeTime(report.reported_at)}
          </Text>
        </View>
        {isOutdated && (
          <View style={styles.outdatedBadge}>
            <Text style={styles.outdatedBadgeText}>Veraltet</Text>
          </View>
        )}
      </View>

      {/* Condition tags */}
      {activeConditions.length > 0 && (
        <View style={styles.tagsRow}>
          {activeConditions.map((key) => {
            const info = CONDITION_LABELS[key];
            if (!info) return null;
            return (
              <View key={key} style={styles.tag}>
                <Text style={styles.tagText}>
                  {info.emoji} {info.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Snow line */}
      {report.snow_line_meters !== null && report.snow_line_meters !== undefined && (
        <View style={styles.snowLine}>
          <Ionicons name="snow" size={14} color={Colors.info} />
          <Text style={styles.snowLineText}>
            Schneegrenze: {report.snow_line_meters} m ü. M.
          </Text>
        </View>
      )}

      {/* Comment */}
      {report.comment && (
        <Text style={[styles.comment, isOutdated && styles.commentOutdated]}>
          {report.comment}
        </Text>
      )}

      {/* Photos */}
      {report.photo_urls && report.photo_urls.length > 0 && (
        <FlatList
          data={report.photo_urls}
          horizontal
          keyExtractor={(url, i) => `${report.id}-photo-${i}`}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item: url }) => (
            <Image source={{ uri: url }} style={styles.photo} />
          )}
          style={styles.photoList}
        />
      )}

      {/* Upvote: eigener Bericht nur Zahl, nach der Stimme ausgefüllt */}
      {upvoteState === 'own' ? (
        <View style={styles.upvoteCount}>
          <Ionicons name="thumbs-up-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.reportDate}>{report.helpfulness_score}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.upvoteButton, isUpvoting && styles.upvoteButtonBusy]}
          onPress={onUpvote}
          disabled={upvoteState === 'voted' || isUpvoting}
          activeOpacity={0.7}
        >
          <Ionicons
            name={upvoteState === 'voted' ? 'thumbs-up' : 'thumbs-up-outline'}
            size={16}
            color={Colors.primary}
          />
          <Text style={styles.upvoteText}>
            Hilfreich ({report.helpfulness_score})
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  lastReportBadge: {
    backgroundColor: Colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lastReportText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    paddingVertical: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  outdatedSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  outdatedHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  reportItem: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  reportItemOutdated: {
    opacity: 0.6,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.border,
  },
  avatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  reportDate: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  outdatedBadge: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  outdatedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.surface,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tag: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagText: {
    fontSize: 12,
    color: Colors.text,
  },
  snowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  snowLineText: {
    fontSize: 12,
    color: Colors.info,
    fontWeight: '500',
  },
  comment: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
    marginBottom: 8,
  },
  commentOutdated: {
    color: Colors.textSecondary,
  },
  photoList: {
    marginBottom: 8,
  },
  photo: {
    width: 100,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: Colors.border,
  },
  upvoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  upvoteButtonBusy: {
    opacity: 0.5,
  },
  upvoteText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
  upvoteCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 12,
  },
  reportButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textOnPrimary,
  },
});
