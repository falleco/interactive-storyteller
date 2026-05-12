import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAnalytics } from '~/features/analytics';
import {
  formatPlayTime,
  getStreakEmoji,
} from '~/features/analytics/utils/analytics-storage';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import type { UserAnalytics } from '~/shared/types/analytics';

export function AnalyticsScreen() {
  const { analytics, isLoading, clearData } = useAnalytics();

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your game statistics and achievements. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearData();
            } catch (error) {
              console.error('Error clearing data:', error);
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.loadingContainer}>
          <ThemedText style={[styles.loadingText, { color: textColor }]}>
            Loading your stats...
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (!analytics) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.errorContainer}>
          <ThemedText style={[styles.errorText, { color: textColor }]}>
            Unable to load statistics
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const StatCard = ({
    title,
    value,
    subtitle,
    icon,
    color = tintColor,
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: string;
    color?: string;
  }) => (
    <View style={[styles.statCard, { backgroundColor }]}>
      <View style={styles.statHeader}>
        <ThemedText style={[styles.statIcon, { color }]}>{icon}</ThemedText>
        <ThemedText style={[styles.statTitle, { color: textColor }]}>
          {title}
        </ThemedText>
      </View>
      <ThemedText style={[styles.statValue, { color }]}>{value}</ThemedText>
      {subtitle && (
        <ThemedText style={[styles.statSubtitle, { color: textColor }]}>
          {subtitle}
        </ThemedText>
      )}
    </View>
  );

  const AchievementCard = ({
    achievement,
  }: {
    achievement: UserAnalytics['achievements'][0];
  }) => (
    <View
      style={[
        styles.achievementCard,
        {
          backgroundColor,
          opacity: achievement.isUnlocked ? 1 : 0.5,
        },
      ]}
    >
      <ThemedText style={[styles.achievementIcon, { color: tintColor }]}>
        {achievement.icon}
      </ThemedText>
      <View style={styles.achievementContent}>
        <ThemedText style={[styles.achievementTitle, { color: textColor }]}>
          {achievement.title}
        </ThemedText>
        <ThemedText
          style={[styles.achievementDescription, { color: textColor }]}
        >
          {achievement.description}
        </ThemedText>
        {achievement.isUnlocked && achievement.unlockedAt && (
          <ThemedText style={[styles.achievementDate, { color: textColor }]}>
            Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
          </ThemedText>
        )}
      </View>
    </View>
  );

  const unlockedAchievements = analytics.achievements.filter(
    (a) => a.isUnlocked,
  ).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText style={[styles.title, { color: textColor }]}>
            📊 Your Stats
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: textColor }]}>
            Track your musical progress
          </ThemedText>
        </View>

        {analytics.totalGamesPlayed === 0 ? (
          <View style={styles.emptyState}>
            <ThemedText style={[styles.emptyIcon, { color: textColor }]}>
              🎵
            </ThemedText>
            <ThemedText style={[styles.emptyTitle, { color: textColor }]}>
              No games played yet
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: textColor }]}>
              Start playing to see your statistics here!
            </ThemedText>
          </View>
        ) : (
          <>
            {/* Main Stats Grid */}
            <View style={styles.statsGrid}>
              <StatCard
                title="Games Played"
                value={analytics.totalGamesPlayed.toLocaleString()}
                icon="🎮"
              />
              <StatCard
                title="Total Score"
                value={analytics.totalScore.toLocaleString()}
                icon="⭐"
              />
              <StatCard
                title="Best Streak"
                value={analytics.bestStreak}
                subtitle={getStreakEmoji(analytics.bestStreak)}
                icon="🔥"
                color="#FF6B35"
              />
              <StatCard
                title="Average Accuracy"
                value={`${analytics.averageAccuracy}%`}
                icon="🎯"
                color="#4CAF50"
              />
              <StatCard
                title="Total Play Time"
                value={formatPlayTime(analytics.totalPlayTime)}
                icon="⏱️"
              />
              <StatCard
                title="Achievements"
                value={`${unlockedAchievements}/${analytics.achievements.length}`}
                icon="🏆"
                color="#FFD700"
              />
            </View>

            {/* Preferences */}
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                🎼 Your Preferences
              </ThemedText>
              <View style={styles.preferencesGrid}>
                <View style={styles.preferenceItem}>
                  <ThemedText
                    style={[styles.preferenceLabel, { color: textColor }]}
                  >
                    Favorite Mode
                  </ThemedText>
                  <ThemedText
                    style={[styles.preferenceValue, { color: tintColor }]}
                  >
                    {analytics.favoriteGameMode
                      .replace('-', ' ')
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </ThemedText>
                  <ThemedText
                    style={[styles.preferenceCount, { color: textColor }]}
                  >
                    {
                      analytics.gamesPerMode[
                        analytics.favoriteGameMode as keyof typeof analytics.gamesPerMode
                      ]
                    }{' '}
                    games
                  </ThemedText>
                </View>
                <View style={styles.preferenceItem}>
                  <ThemedText
                    style={[styles.preferenceLabel, { color: textColor }]}
                  >
                    Favorite Notation
                  </ThemedText>
                  <ThemedText
                    style={[styles.preferenceValue, { color: tintColor }]}
                  >
                    {analytics.favoriteNotation === 'letter'
                      ? 'Letters'
                      : 'Solfege'}
                  </ThemedText>
                  <ThemedText
                    style={[styles.preferenceCount, { color: textColor }]}
                  >
                    {
                      analytics.gamesPerNotation[
                        analytics.favoriteNotation as keyof typeof analytics.gamesPerNotation
                      ]
                    }{' '}
                    games
                  </ThemedText>
                </View>
                <View style={styles.preferenceItem}>
                  <ThemedText
                    style={[styles.preferenceLabel, { color: textColor }]}
                  >
                    Favorite Difficulty
                  </ThemedText>
                  <ThemedText
                    style={[styles.preferenceValue, { color: tintColor }]}
                  >
                    {analytics.favoriteDifficulty.charAt(0).toUpperCase() +
                      analytics.favoriteDifficulty.slice(1)}
                  </ThemedText>
                  <ThemedText
                    style={[styles.preferenceCount, { color: textColor }]}
                  >
                    {
                      analytics.gamesPerDifficulty[
                        analytics.favoriteDifficulty as keyof typeof analytics.gamesPerDifficulty
                      ]
                    }{' '}
                    games
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Achievements */}
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                🏆 Achievements ({unlockedAchievements}/
                {analytics.achievements.length})
              </ThemedText>
              <View style={styles.achievementsContainer}>
                {analytics.achievements.map((achievement) => (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                  />
                ))}
              </View>
            </View>

            {/* Recent Sessions */}
            {analytics.recentSessions.length > 0 && (
              <View style={styles.section}>
                <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                  📈 Recent Games
                </ThemedText>
                {analytics.recentSessions.slice(0, 5).map((session) => (
                  <View
                    key={session.id}
                    style={[styles.sessionCard, { backgroundColor }]}
                  >
                    <View style={styles.sessionHeader}>
                      <ThemedText
                        style={[styles.sessionMode, { color: textColor }]}
                      >
                        {session.gameMode
                          .replace('-', ' ')
                          .replace(/\b\w/g, (l) => l.toUpperCase())}{' '}
                        •{' '}
                        {session.notationSystem === 'letter'
                          ? 'Letters'
                          : 'Solfege'}
                      </ThemedText>
                      <ThemedText
                        style={[styles.sessionDate, { color: textColor }]}
                      >
                        {new Date(session.date).toLocaleDateString()}
                      </ThemedText>
                    </View>
                    <View style={styles.sessionStats}>
                      <ThemedText
                        style={[styles.sessionStat, { color: tintColor }]}
                      >
                        Score: {session.score}
                      </ThemedText>
                      <ThemedText
                        style={[styles.sessionStat, { color: textColor }]}
                      >
                        Accuracy: {session.accuracy}%
                      </ThemedText>
                      <ThemedText
                        style={[styles.sessionStat, { color: textColor }]}
                      >
                        Best Streak: {session.maxStreak}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Clear Data Button */}
            <View style={styles.section}>
              <Pressable
                style={[styles.clearButton, { borderColor: '#F44336' }]}
                onPress={handleClearData}
              >
                <ThemedText
                  style={[styles.clearButtonText, { color: '#F44336' }]}
                >
                  🗑️ Clear All Data
                </ThemedText>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 30,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 12,
    opacity: 0.7,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  preferencesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  preferenceItem: {
    width: '48%',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    alignItems: 'center',
  },
  preferenceLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  preferenceValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  preferenceCount: {
    fontSize: 12,
    opacity: 0.7,
  },
  achievementsContainer: {
    gap: 12,
  },
  achievementCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  achievementIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 4,
  },
  achievementDate: {
    fontSize: 12,
    opacity: 0.6,
  },
  sessionCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionMode: {
    fontSize: 16,
    fontWeight: '600',
  },
  sessionDate: {
    fontSize: 14,
    opacity: 0.7,
  },
  sessionStats: {
    flexDirection: 'row',
    gap: 16,
  },
  sessionStat: {
    fontSize: 14,
  },
  clearButton: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
