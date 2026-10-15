import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { queryKeys } from '../lib/queryKeys';
import type { GroupEvent, EventResponse } from '../types';

export function useEvents() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  // ─── Upcoming events query ───────────────────────────────
  const upcomingEventsQuery = useQuery({
    queryKey: queryKeys.events.upcoming(userId ?? ''),
    queryFn: async (): Promise<GroupEvent[]> => {
      if (!userId) return [];

      // Get user's group IDs
      const { data: groupMemberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId);

      const groupIds = (groupMemberships ?? []).map((gm: any) => gm.group_id);

      // Get user's community IDs
      const { data: communityMemberships } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', userId);

      const communityIds = (communityMemberships ?? []).map((cm: any) => cm.community_id);

      if (groupIds.length === 0 && communityIds.length === 0) return [];

      // Load events from groups and communities
      let query = supabase
        .from('group_events')
        .select('*')
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(50);

      if (groupIds.length > 0 && communityIds.length > 0) {
        query = query.or(
          `group_id.in.(${groupIds.join(',')}),community_id.in.(${communityIds.join(',')})`,
        );
      } else if (groupIds.length > 0) {
        query = query.in('group_id', groupIds);
      } else {
        query = query.in('community_id', communityIds);
      }

      const { data } = await query;
      return (data ?? []) as GroupEvent[];
    },
    enabled: !!userId,
  });

  const upcomingEvents = upcomingEventsQuery.data ?? [];

  const fetchUpcomingEvents = useCallback(
    () => upcomingEventsQuery.refetch(),
    [upcomingEventsQuery],
  );

  // ─── Create event mutation ───────────────────────────────
  const createEventMutation = useMutation({
    mutationFn: async (params: {
      groupId?: string;
      communityId?: string;
      title: string;
      description?: string;
      date: string;
      meetingPoint?: string;
      meetingLocation?: { latitude: number; longitude: number };
    }): Promise<GroupEvent | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('group_events')
        .insert({
          group_id: params.groupId ?? null,
          community_id: params.communityId ?? null,
          title: params.title,
          description: params.description ?? null,
          event_date: params.date,
          meeting_point: params.meetingPoint ?? null,
          meeting_location: params.meetingLocation
            ? `POINT(${params.meetingLocation.longitude} ${params.meetingLocation.latitude})`
            : null,
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        console.error('Event erstellen fehlgeschlagen:', error);
        return null;
      }

      return data as GroupEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.upcoming(userId!) });
    },
  });

  const createEvent = useCallback(
    (params: {
      groupId?: string;
      communityId?: string;
      title: string;
      description?: string;
      date: string;
      meetingPoint?: string;
      meetingLocation?: { latitude: number; longitude: number };
    }) => createEventMutation.mutateAsync(params),
    [createEventMutation],
  );

  // ─── Respond to event mutation ───────────────────────────
  const respondToEventMutation = useMutation({
    mutationFn: async ({
      eventId,
      response,
    }: {
      eventId: string;
      response: 'attending' | 'declined' | 'maybe';
    }) => {
      if (!userId) return;

      // Upsert: update if already responded
      const { data: existing } = await supabase
        .from('event_responses')
        .select('event_id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('event_responses')
          .update({ response })
          .eq('event_id', eventId)
          .eq('user_id', userId);
        if (error) console.error('Event-Antwort aktualisieren fehlgeschlagen:', error);
      } else {
        const { error } = await supabase
          .from('event_responses')
          .insert({ event_id: eventId, user_id: userId, response });
        if (error) console.error('Event-Antwort speichern fehlgeschlagen:', error);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.upcoming(userId!) });
    },
  });

  const respondToEvent = useCallback(
    (eventId: string, response: 'attending' | 'declined' | 'maybe') =>
      respondToEventMutation.mutateAsync({ eventId, response }),
    [respondToEventMutation],
  );

  // ─── Get event responses (imperative) ───────────────────
  const getEventResponses = useCallback(
    async (eventId: string): Promise<(EventResponse & { user?: any })[]> => {
      const { data } = await supabase
        .from('event_responses')
        .select('*, user:users(username, display_name, avatar_url)')
        .eq('event_id', eventId);

      return (data ?? []) as (EventResponse & { user?: any })[];
    },
    [],
  );

  // ─── Delete event mutation ───────────────────────────────
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      if (!userId) throw new Error('Not authenticated');

      // Delete responses first
      await supabase.from('event_responses').delete().eq('event_id', eventId);

      const { error } = await supabase
        .from('group_events')
        .delete()
        .eq('id', eventId);

      if (error) {
        console.error('Delete event failed:', error);
        throw error;
      }
    },
    onMutate: async (eventId: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.events.upcoming(userId!) });
      const prev = queryClient.getQueryData<GroupEvent[]>(queryKeys.events.upcoming(userId!));
      queryClient.setQueryData<GroupEvent[]>(
        queryKeys.events.upcoming(userId!),
        (old) => (old ?? []).filter((e) => e.id !== eventId),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(queryKeys.events.upcoming(userId!), ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.upcoming(userId!) });
    },
  });

  const deleteEvent = useCallback(
    (eventId: string) => deleteEventMutation.mutateAsync(eventId),
    [deleteEventMutation],
  );

  return {
    createEvent,
    upcomingEvents,
    respondToEvent,
    getEventResponses,
    deleteEvent,
    fetchUpcomingEvents,
  };
}
