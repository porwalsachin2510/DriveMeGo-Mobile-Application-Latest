import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { SubScreen, errorMessage } from "../src/components/SubScreen";
import { Badge, Button, Card, Chip, EmptyState, Loading } from "../src/components/ui";
import { engagementService } from "../src/services";
import { formatDateLong } from "../src/utils/format";
import { colors, radius } from "../src/theme";

const TABS = [
  { key: "", label: "All" },
  { key: "NEWS", label: "News" },
  { key: "BLOG", label: "Blog" },
];

export default function NewsScreen() {
  const [type, setType] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [openSlug, setOpenSlug] = useState(null);
  const [bodies, setBodies] = useState({});
  const [loadingBody, setLoadingBody] = useState(null);

  const load = useCallback(
    async ({ nextPage = 1, nextType = type, refresh = false } = {}) => {
      if (refresh) setRefreshing(true);
      else if (nextPage > 1) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const res = await engagementService.posts({ page: nextPage, limit: 10, type: nextType || undefined });
        const data = res?.data || {};
        setItems((prev) => (nextPage > 1 ? [...prev, ...(data.items || [])] : data.items || []));
        setPage(nextPage);
        setHasMore(!!data.hasMore);
      } catch (e) {
        setError(errorMessage(e, "Could not load articles."));
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [type]
  );

  useFocusEffect(
    useCallback(() => {
      load({ nextPage: 1 });
    }, [load])
  );

  const toggle = async (post) => {
    if (openSlug === post.slug) return setOpenSlug(null);
    setOpenSlug(post.slug);
    if (bodies[post.slug]) return;
    setLoadingBody(post.slug);
    try {
      const res = await engagementService.post(post.slug);
      setBodies((prev) => ({ ...prev, [post.slug]: res?.data?.post?.content || "" }));
    } catch (e) {
      setBodies((prev) => ({ ...prev, [post.slug]: errorMessage(e, "Could not load this article.") }));
    } finally {
      setLoadingBody(null);
    }
  };

  return (
    <SubScreen eyebrow="Updates" title="News & Blog" subtitle="Latest updates and travel tips." icon="newspaper-outline" refreshing={refreshing} onRefresh={() => load({ refresh: true })}>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Chip
            key={t.label}
            label={t.label}
            active={type === t.key}
            onPress={() => {
              setType(t.key);
              load({ nextPage: 1, nextType: t.key });
            }}
          />
        ))}
      </View>

      {loading ? (
        <Loading label="Loading articles..." />
      ) : error ? (
        <EmptyState icon="alert-circle-outline" title="Something went wrong" message={error} action={<Button title="Try again" onPress={() => load({ nextPage: 1 })} />} />
      ) : items.length === 0 ? (
        <EmptyState icon="newspaper-outline" title="Nothing published yet" message="Check back soon for news and travel tips." />
      ) : (
        <View style={{ gap: 14 }}>
          {items.map((p) => {
            const open = openSlug === p.slug;
            return (
              <Card key={p._id} style={{ overflow: "hidden" }}>
                <Pressable onPress={() => toggle(p)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
                  {p.coverImage ? <Image source={{ uri: p.coverImage }} style={styles.cover} contentFit="cover" /> : null}
                  <View style={{ padding: 16 }}>
                    <View style={styles.meta}>
                      <Badge label={p.type === "NEWS" ? "News" : "Blog"} tone={p.type === "NEWS" ? "teal" : "warning"} />
                      <Text style={styles.date}>{formatDateLong(p.publishedAt)}</Text>
                    </View>
                    <Text style={styles.title}>{p.title}</Text>
                    {!open && p.excerpt ? (
                      <Text style={styles.excerpt} numberOfLines={2}>
                        {p.excerpt}
                      </Text>
                    ) : null}
                    {open ? (
                      loadingBody === p.slug ? (
                        <ActivityIndicator color={colors.teal} style={{ marginTop: 14 }} />
                      ) : (
                        <Text style={styles.body}>{bodies[p.slug]}</Text>
                      )
                    ) : (
                      <Text style={styles.more}>Read more</Text>
                    )}
                  </View>
                </Pressable>
              </Card>
            );
          })}
          {hasMore ? <Button title="Load more" variant="outline" icon="chevron-down" loading={loadingMore} onPress={() => load({ nextPage: page + 1 })} /> : null}
        </View>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 8, marginBottom: 14 },
  cover: { width: "100%", height: 150, backgroundColor: colors.tealSoft },
  meta: { flexDirection: "row", alignItems: "center", gap: 10 },
  date: { fontSize: 12, color: colors.muted },
  title: { fontSize: 17, fontWeight: "800", color: colors.navy, marginTop: 10 },
  excerpt: { fontSize: 13.5, color: colors.muted, marginTop: 6, lineHeight: 19 },
  body: { fontSize: 14.5, color: colors.navy, marginTop: 12, lineHeight: 22 },
  more: { fontSize: 13, fontWeight: "800", color: colors.tealDark, marginTop: 10, borderRadius: radius.pill },
});
