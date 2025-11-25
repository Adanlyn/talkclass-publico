--
-- PostgreSQL database dump
--

\restrict 8hY1O6hFuHNVxGU9i5cllkHrTv9D1TytbxP9tmx1EEKPPUyYXStVgssVBWuBA10

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS '';


--
-- Name: tc_analytics; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA tc_analytics;


ALTER SCHEMA tc_analytics OWNER TO postgres;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: ensure_pergunta(uuid, text, integer, integer, boolean); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.ensure_pergunta(IN p_categoria_id uuid, IN p_texto text, IN p_tipo integer, IN p_ord integer, IN p_obrigatoria boolean)
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT "Id"
    INTO v_id
    FROM public.perguntas
   WHERE "CategoriaId" = p_categoria_id
     AND lower("Texto") = lower(p_texto)
   LIMIT 1;

  IF v_id IS NULL THEN
    v_id := uuid_generate_v4();
    INSERT INTO public.perguntas("Id","CategoriaId","Texto","Tipo","Obrigatoria","Ativa","Ordem")
    VALUES (v_id, p_categoria_id, p_texto, p_tipo, COALESCE(p_obrigatoria, FALSE), TRUE, COALESCE(p_ord,0));
  ELSE
    UPDATE public.perguntas
       SET "Tipo"        = p_tipo,
           "Obrigatoria" = COALESCE(p_obrigatoria, "Obrigatoria"),
           "Ativa"       = TRUE,
           "Ordem"       = COALESCE(p_ord, "Ordem")
     WHERE "Id" = v_id;
  END IF;
END;
$$;


ALTER PROCEDURE public.ensure_pergunta(IN p_categoria_id uuid, IN p_texto text, IN p_tipo integer, IN p_ord integer, IN p_obrigatoria boolean) OWNER TO postgres;

--
-- Name: ensure_pergunta(uuid, text, integer, integer, boolean, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ensure_pergunta(p_categoria_id uuid, p_enunciado text, p_tipo integer, p_ord integer, p_obrigatoria boolean, p_ativa boolean) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE v_id uuid;
BEGIN
  SELECT "Id" INTO v_id
  FROM public.perguntas
  WHERE "CategoriaId" = p_categoria_id
    AND lower("Enunciado") = lower(p_enunciado)
  LIMIT 1;

  IF v_id IS NULL THEN
    v_id := uuid_generate_v4();
    INSERT INTO public.perguntas
      ("Id","CategoriaId","Enunciado","Tipo","Obrigatoria","Ordem","Ativa")
    VALUES
      (v_id, p_categoria_id, p_enunciado, p_tipo, p_obrigatoria, p_ord, p_ativa);
  ELSE
    UPDATE public.perguntas
       SET "Tipo"        = COALESCE(p_tipo,"Tipo"),
           "Obrigatoria" = COALESCE(p_obrigatoria,"Obrigatoria"),
           "Ordem"       = COALESCE(p_ord,"Ordem"),
           "Ativa"       = COALESCE(p_ativa,"Ativa")
     WHERE "Id" = v_id;
  END IF;
  RETURN v_id;
END$$;


ALTER FUNCTION public.ensure_pergunta(p_categoria_id uuid, p_enunciado text, p_tipo integer, p_ord integer, p_obrigatoria boolean, p_ativa boolean) OWNER TO postgres;

--
-- Name: upsert_categoria(text, text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.upsert_categoria(p_nome text, p_desc text, p_ord integer) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE v_id uuid;
BEGIN
  SELECT "Id" INTO v_id FROM public.categorias
   WHERE lower("Nome") = lower(p_nome) LIMIT 1;

  IF v_id IS NULL THEN
    v_id := uuid_generate_v4();
    INSERT INTO public.categorias ("Id","Nome","Descricao","Ativa","Ordem")
    VALUES (v_id, p_nome, p_desc, TRUE, COALESCE(p_ord,0));
  ELSE
    UPDATE public.categorias
       SET "Descricao" = COALESCE(p_desc,"Descricao"),
           "Ativa"     = TRUE,
           "Ordem"     = COALESCE(p_ord,"Ordem")
     WHERE "Id" = v_id;
  END IF;
  RETURN v_id;
END$$;


ALTER FUNCTION public.upsert_categoria(p_nome text, p_desc text, p_ord integer) OWNER TO postgres;

--
-- Name: _normalize_txt(text); Type: FUNCTION; Schema: tc_analytics; Owner: postgres
--

CREATE FUNCTION tc_analytics._normalize_txt(s text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
  SELECT translate(
           lower(unaccent(s)),
           -- fallback leve caso unaccent ext não esteja ativa:
           'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇ',
           'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcC'
         );
$$;


ALTER FUNCTION tc_analytics._normalize_txt(s text) OWNER TO postgres;

--
-- Name: _nota_thresholds(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: tc_analytics; Owner: postgres
--

CREATE FUNCTION tc_analytics._nota_thresholds(from_ts timestamp with time zone, to_ts timestamp with time zone) RETURNS TABLE(lo double precision, hi double precision)
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
  SELECT 2.5::double precision AS lo, 3.5::double precision AS hi;
$$;


ALTER FUNCTION tc_analytics._nota_thresholds(from_ts timestamp with time zone, to_ts timestamp with time zone) OWNER TO postgres;

--
-- Name: extract_keywords(text); Type: FUNCTION; Schema: tc_analytics; Owner: postgres
--

CREATE FUNCTION tc_analytics.extract_keywords(t text) RETURNS SETOF text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
  SELECT w
  FROM (
    SELECT token AS w
    FROM regexp_split_to_table(lower(unaccent(coalesce(t,''))), E'[^a-z0-9]+') AS token
  ) s
  WHERE length(w) >= 4
    AND w !~ '^\d+$'
    AND NOT EXISTS (SELECT 1 FROM tc_analytics.stopwords_pt sw WHERE sw.word = w);
$_$;


ALTER FUNCTION tc_analytics.extract_keywords(t text) OWNER TO postgres;

--
-- Name: v_words_week_neg_top(timestamp with time zone, timestamp with time zone, integer); Type: FUNCTION; Schema: tc_analytics; Owner: postgres
--

CREATE FUNCTION tc_analytics.v_words_week_neg_top(p_from timestamp with time zone, p_to timestamp with time zone, p_top integer) RETURNS TABLE("Week" date, "CategoryId" uuid, "Word" text, "Total" bigint, "Score" numeric)
    LANGUAGE sql
    AS $$
WITH base AS (
  SELECT m.week, m.category_id, m.word, m.total, 0::numeric AS score
  FROM tc_analytics.mv_words_week m
  WHERE m.week BETWEEN date_trunc('week', p_from)::date AND date_trunc('week', p_to)::date
    AND m.sentiment < 0                 -- só negativas
),
ranked AS (
  SELECT b.*,
         row_number() OVER (
           PARTITION BY b.week, b.category_id   -- <<< idem
           ORDER BY b.total DESC
         ) AS rn
  FROM base b
)
SELECT week AS "Week", category_id AS "CategoryId", word AS "Word", total AS "Total", score AS "Score"
FROM ranked
WHERE rn <= p_top
ORDER BY "Week","Word";
$$;


ALTER FUNCTION tc_analytics.v_words_week_neg_top(p_from timestamp with time zone, p_to timestamp with time zone, p_top integer) OWNER TO postgres;

--
-- Name: v_words_week_pos_top(timestamp with time zone, timestamp with time zone, integer); Type: FUNCTION; Schema: tc_analytics; Owner: postgres
--

CREATE FUNCTION tc_analytics.v_words_week_pos_top(p_from timestamp with time zone, p_to timestamp with time zone, p_top integer) RETURNS TABLE("Week" date, "CategoryId" uuid, "Word" text, "Total" bigint, "Score" numeric)
    LANGUAGE sql
    AS $$
WITH base AS (
  SELECT m.week, m.category_id, m.word, m.total, 0::numeric AS score
  FROM tc_analytics.mv_words_week m
  WHERE m.week BETWEEN date_trunc('week', p_from)::date AND date_trunc('week', p_to)::date
    AND m.sentiment > 0                 -- só positivas
),
ranked AS (
  SELECT b.*,
         row_number() OVER (
           PARTITION BY b.week, b.category_id   -- <<< aqui é a correção
           ORDER BY b.total DESC
         ) AS rn
  FROM base b
)
SELECT week AS "Week", category_id AS "CategoryId", word AS "Word", total AS "Total", score AS "Score"
FROM ranked
WHERE rn <= p_top
ORDER BY "Week","Word";
$$;


ALTER FUNCTION tc_analytics.v_words_week_pos_top(p_from timestamp with time zone, p_to timestamp with time zone, p_top integer) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: administradores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.administradores (
    "Id" uuid NOT NULL,
    "Nome" character varying(120) NOT NULL,
    "Email" character varying(160),
    "Cpf" character varying(11) NOT NULL,
    "SenhaHash" character varying(200) NOT NULL,
    "IsActive" boolean NOT NULL,
    "Roles" character varying(100) NOT NULL,
    "CreatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "MustChangePassword" boolean DEFAULT false NOT NULL,
    CONSTRAINT ck_adm_cpf_digits CHECK ((("Cpf")::text ~ '^[0-9]{11}$'::text))
);


ALTER TABLE public.administradores OWNER TO postgres;

--
-- Name: alert_email_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alert_email_config (
    "Id" uuid NOT NULL,
    "AdminRecipientIds" uuid[] NOT NULL,
    "ExtraEmails" character varying(600) DEFAULT ''::character varying NOT NULL,
    "SendMode" character varying(20) DEFAULT 'immediate'::character varying NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    "CriticalKeywords" character varying(1000) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE public.alert_email_config OWNER TO postgres;

--
-- Name: alert_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alert_notifications (
    "Id" uuid NOT NULL,
    "Title" character varying(160) NOT NULL,
    "Message" character varying(600) NOT NULL,
    "Severity" character varying(20) DEFAULT 'info'::character varying NOT NULL,
    "Read" boolean DEFAULT false NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "FeedbackId" uuid
);


ALTER TABLE public.alert_notifications OWNER TO postgres;

--
-- Name: alert_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alert_rules (
    "Id" uuid NOT NULL,
    "Nome" character varying(160) NOT NULL,
    "CategoriaId" uuid,
    "NotaMinima" numeric(3,2) NOT NULL,
    "PeriodoDias" integer NOT NULL,
    "EnviarEmail" boolean DEFAULT true NOT NULL,
    "Ativa" boolean DEFAULT true NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone
);


ALTER TABLE public.alert_rules OWNER TO postgres;

--
-- Name: categorias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categorias (
    "Id" uuid NOT NULL,
    "Nome" character varying(120) NOT NULL,
    "Descricao" character varying(500),
    "Ativa" boolean DEFAULT true NOT NULL,
    "Ordem" integer DEFAULT 0 NOT NULL,
    "CriadoEm" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.categorias OWNER TO postgres;

--
-- Name: feedback_respostas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.feedback_respostas (
    "Id" uuid NOT NULL,
    "FeedbackId" uuid NOT NULL,
    "PerguntaId" uuid NOT NULL,
    "Tipo" smallint NOT NULL,
    "ValorNota" numeric(4,2),
    "ValorBool" boolean,
    "ValorOpcao" text,
    "ValorTexto" text,
    CONSTRAINT chk_valornota_1_5 CHECK ((("Tipo" <> 0) OR (("ValorNota" >= (1)::numeric) AND ("ValorNota" <= (5)::numeric))))
);


ALTER TABLE public.feedback_respostas OWNER TO postgres;

--
-- Name: feedbacks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.feedbacks (
    "Id" uuid NOT NULL,
    "CategoriaId" uuid NOT NULL,
    "CriadoEm" timestamp with time zone DEFAULT now() NOT NULL,
    "CursoOuTurma" text,
    "NomeIdentificado" text,
    "ContatoIdentificado" text
);


ALTER TABLE public.feedbacks OWNER TO postgres;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    "Id" uuid NOT NULL,
    "AdministradorId" uuid NOT NULL,
    "TokenHash" character varying(128) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "ExpiresAt" timestamp with time zone NOT NULL,
    "UsedAt" timestamp with time zone
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- Name: pergunta_opcoes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pergunta_opcoes (
    "Id" uuid NOT NULL,
    "PerguntaId" uuid NOT NULL,
    "Texto" text NOT NULL,
    "Valor" integer NOT NULL
);


ALTER TABLE public.pergunta_opcoes OWNER TO postgres;

--
-- Name: perguntas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.perguntas (
    "Id" uuid NOT NULL,
    "CategoriaId" uuid NOT NULL,
    "Enunciado" text NOT NULL,
    "Tipo" smallint NOT NULL,
    "Ativa" boolean DEFAULT true NOT NULL,
    "Obrigatoria" boolean DEFAULT false NOT NULL,
    "Ordem" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.perguntas OWNER TO postgres;

--
-- Name: v_topics_semana; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_topics_semana AS
 SELECT (date_trunc('week'::text, f."CriadoEm"))::date AS week,
    lower(m.m[1]) AS topic,
    count(*) AS total
   FROM ((public.feedback_respostas r
     JOIN public.feedbacks f ON ((f."Id" = r."FeedbackId")))
     CROSS JOIN LATERAL regexp_matches(COALESCE(r."ValorTexto", ''::text), '#([[:alnum:]_]+)'::text, 'g'::text) m(m))
  WHERE (r."Tipo" = 3)
  GROUP BY ((date_trunc('week'::text, f."CriadoEm"))::date), (lower(m.m[1]))
  ORDER BY ((date_trunc('week'::text, f."CriadoEm"))::date), (lower(m.m[1]));


ALTER VIEW public.v_topics_semana OWNER TO postgres;

--
-- Name: lexicon_pt; Type: TABLE; Schema: tc_analytics; Owner: postgres
--

CREATE TABLE tc_analytics.lexicon_pt (
    word text NOT NULL,
    sentiment smallint NOT NULL,
    weight numeric(3,2) DEFAULT 1.00 NOT NULL,
    CONSTRAINT lexicon_pt_weight_check CHECK (((weight > (0)::numeric) AND (weight <= (2)::numeric)))
);


ALTER TABLE tc_analytics.lexicon_pt OWNER TO postgres;

--
-- Name: mv_words_week; Type: MATERIALIZED VIEW; Schema: tc_analytics; Owner: postgres
--

CREATE MATERIALIZED VIEW tc_analytics.mv_words_week AS
 SELECT (date_trunc('week'::text, f."CriadoEm"))::date AS week,
    f."CategoriaId" AS category_id,
    k.k AS word,
    l.sentiment,
    count(*) AS total
   FROM (((public.feedback_respostas r
     JOIN public.feedbacks f ON ((f."Id" = r."FeedbackId")))
     CROSS JOIN LATERAL tc_analytics.extract_keywords(r."ValorTexto") k(k))
     JOIN tc_analytics.lexicon_pt l ON ((l.word = k.k)))
  WHERE ((r."ValorTexto" IS NOT NULL) AND (btrim(r."ValorTexto") <> ''::text))
  GROUP BY ((date_trunc('week'::text, f."CriadoEm"))::date), f."CategoriaId", k.k, l.sentiment
  WITH NO DATA;


ALTER MATERIALIZED VIEW tc_analytics.mv_words_week OWNER TO postgres;

--
-- Name: stopwords_pt; Type: TABLE; Schema: tc_analytics; Owner: postgres
--

CREATE TABLE tc_analytics.stopwords_pt (
    word text NOT NULL
);


ALTER TABLE tc_analytics.stopwords_pt OWNER TO postgres;

--
-- Name: v_topics_week; Type: VIEW; Schema: tc_analytics; Owner: postgres
--

CREATE VIEW tc_analytics.v_topics_week AS
 SELECT (date_trunc('week'::text, f."CriadoEm"))::date AS week,
    k.k AS topic,
    count(*) AS total
   FROM ((public.feedback_respostas r
     JOIN public.feedbacks f ON ((f."Id" = r."FeedbackId")))
     CROSS JOIN LATERAL tc_analytics.extract_keywords(r."ValorTexto") k(k))
  WHERE ((r."ValorTexto" IS NOT NULL) AND (btrim(r."ValorTexto") <> ''::text))
  GROUP BY ((date_trunc('week'::text, f."CriadoEm"))::date), k.k;


ALTER VIEW tc_analytics.v_topics_week OWNER TO postgres;

--
-- Name: v_topics_week_top; Type: VIEW; Schema: tc_analytics; Owner: postgres
--

CREATE VIEW tc_analytics.v_topics_week_top AS
 WITH agg AS (
         SELECT v_topics_week.topic,
            sum(v_topics_week.total) AS gtotal
           FROM tc_analytics.v_topics_week
          GROUP BY v_topics_week.topic
        ), ranked AS (
         SELECT v.week,
            v.topic,
            v.total,
            dense_rank() OVER (ORDER BY a.gtotal DESC) AS rk
           FROM (tc_analytics.v_topics_week v
             JOIN agg a USING (topic))
        )
 SELECT week,
    topic,
    total,
    rk
   FROM ranked;


ALTER VIEW tc_analytics.v_topics_week_top OWNER TO postgres;

--
-- Name: v_words_week_neg_top; Type: VIEW; Schema: tc_analytics; Owner: postgres
--

CREATE VIEW tc_analytics.v_words_week_neg_top AS
 WITH agg AS (
         SELECT mv_words_week.word,
            sum(mv_words_week.total) AS gtotal
           FROM tc_analytics.mv_words_week
          WHERE (mv_words_week.sentiment = '-1'::integer)
          GROUP BY mv_words_week.word
        ), ranked AS (
         SELECT v.week,
            v.category_id,
            v.word,
            v.total,
            dense_rank() OVER (ORDER BY a.gtotal DESC) AS rk
           FROM (tc_analytics.mv_words_week v
             JOIN agg a USING (word))
          WHERE (v.sentiment = '-1'::integer)
        )
 SELECT week,
    category_id,
    word,
    total,
    rk
   FROM ranked;


ALTER VIEW tc_analytics.v_words_week_neg_top OWNER TO postgres;

--
-- Name: v_words_week_pos_top; Type: VIEW; Schema: tc_analytics; Owner: postgres
--

CREATE VIEW tc_analytics.v_words_week_pos_top AS
 WITH agg AS (
         SELECT mv_words_week.word,
            sum(mv_words_week.total) AS gtotal
           FROM tc_analytics.mv_words_week
          WHERE (mv_words_week.sentiment = 1)
          GROUP BY mv_words_week.word
        ), ranked AS (
         SELECT v.week,
            v.category_id,
            v.word,
            v.total,
            dense_rank() OVER (ORDER BY a.gtotal DESC) AS rk
           FROM (tc_analytics.mv_words_week v
             JOIN agg a USING (word))
          WHERE (v.sentiment = 1)
        )
 SELECT week,
    category_id,
    word,
    total,
    rk
   FROM ranked;


ALTER VIEW tc_analytics.v_words_week_pos_top OWNER TO postgres;

--Chave primária administradores
ALTER TABLE ONLY public.administradores
    ADD CONSTRAINT "PK_administradores" PRIMARY KEY ("Id");

--Chave primária alert_notifications
ALTER TABLE ONLY public.alert_notifications
    ADD CONSTRAINT alert_notifications_pkey PRIMARY KEY ("Id");

--Chave primária alert_rules
ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_pkey PRIMARY KEY ("Id");

--Chave primária categorias
ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY ("Id");

--Chave primária feedback_respostas
ALTER TABLE ONLY public.feedback_respostas
    ADD CONSTRAINT feedback_respostas_pkey PRIMARY KEY ("Id");

--Chave primária feedbacks
ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_pkey PRIMARY KEY ("Id");

--TokenHash único em password_reset_tokens
ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT "password_reset_tokens_TokenHash_key" UNIQUE ("TokenHash");

--Chave primária password_reset_tokens
ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY ("Id");

--Chave primária pergunta_opcoes
ALTER TABLE ONLY public.pergunta_opcoes
    ADD CONSTRAINT pergunta_opcoes_pkey PRIMARY KEY ("Id");

--Chave primária perguntas
ALTER TABLE ONLY public.perguntas
    ADD CONSTRAINT perguntas_pkey PRIMARY KEY ("Id");



--Chave primária alert_email_config
ALTER TABLE ONLY public.alert_email_config
    ADD CONSTRAINT alert_email_config_pkey PRIMARY KEY ("Id");
--
-- Name: lexicon_pt lexicon_pt_pkey; Type: CONSTRAINT; Schema: tc_analytics; Owner: postgres
--

ALTER TABLE ONLY tc_analytics.lexicon_pt
    ADD CONSTRAINT lexicon_pt_pkey PRIMARY KEY (word);


--
-- Name: stopwords_pt stopwords_pt_pkey; Type: CONSTRAINT; Schema: tc_analytics; Owner: postgres
--

ALTER TABLE ONLY tc_analytics.stopwords_pt
    ADD CONSTRAINT stopwords_pt_pkey PRIMARY KEY (word);


--
-- Name: IX_administradores_Cpf; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "IX_administradores_Cpf" ON public.administradores USING btree ("Cpf");


--
-- Name: IX_administradores_IsActive; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_administradores_IsActive" ON public.administradores USING btree ("IsActive");


--
-- Name: IX_alert_notifications_CreatedAt; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_alert_notifications_CreatedAt" ON public.alert_notifications USING btree ("CreatedAt");


--
-- Name: IX_alert_notifications_FeedbackId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_alert_notifications_FeedbackId" ON public.alert_notifications USING btree ("FeedbackId");


--
-- Name: IX_alert_notifications_Read; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_alert_notifications_Read" ON public.alert_notifications USING btree ("Read");


--
-- Name: IX_feedback_respostas_Tipo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_feedback_respostas_Tipo" ON public.feedback_respostas USING btree ("Tipo");


--
-- Name: idx_feedback_respostas_feedback; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_feedback_respostas_feedback ON public.feedback_respostas USING btree ("FeedbackId");


--
-- Name: idx_feedbacks_criadoem; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_feedbacks_criadoem ON public.feedbacks USING btree ("CriadoEm");


--
-- Name: idx_fr_feedback; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fr_feedback ON public.feedback_respostas USING btree ("FeedbackId");


--
-- Name: idx_fr_pergunta_tipo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fr_pergunta_tipo ON public.feedback_respostas USING btree ("PerguntaId", "Tipo");


--
-- Name: ix_alert_rules_ativa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_alert_rules_ativa ON public.alert_rules USING btree ("Ativa");


--
-- Name: ix_alert_rules_categoria; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_alert_rules_categoria ON public.alert_rules USING btree ("CategoriaId");


--
-- Name: ix_fr_tipo_nota; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_fr_tipo_nota ON public.feedback_respostas USING btree ("ValorNota") WHERE ("Tipo" = 0);


--
-- Name: ix_fr_valortexto_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_fr_valortexto_gin ON public.feedback_respostas USING gin ("ValorTexto" public.gin_trgm_ops);


--
-- Name: ix_password_reset_tokens_admin_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_password_reset_tokens_admin_expires ON public.password_reset_tokens USING btree ("AdministradorId", "ExpiresAt");


--
-- Name: ux_administradores_email_lower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ux_administradores_email_lower ON public.administradores USING btree (lower(("Email")::text)) WHERE ("Email" IS NOT NULL);


--
-- Name: ux_categorias_nome_lower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ux_categorias_nome_lower ON public.categorias USING btree (lower(("Nome")::text));


--
-- Name: mv_words_week_uniq; Type: INDEX; Schema: tc_analytics; Owner: postgres
--

CREATE UNIQUE INDEX mv_words_week_uniq ON tc_analytics.mv_words_week USING btree (week, category_id, word, sentiment);


--
-- Name: mv_words_week_week_cat; Type: INDEX; Schema: tc_analytics; Owner: postgres
--

CREATE INDEX mv_words_week_week_cat ON tc_analytics.mv_words_week USING btree (week, category_id);


--
-- Name: ux_lexicon_pt_word; Type: INDEX; Schema: tc_analytics; Owner: postgres
--

CREATE UNIQUE INDEX ux_lexicon_pt_word ON tc_analytics.lexicon_pt USING btree (word);


-- Perguntas pertencem a Categorias (exclusão em cascata)
ALTER TABLE ONLY public.feedback_respostas
    ADD CONSTRAINT "feedback_respostas_FeedbackId_fkey" FOREIGN KEY ("FeedbackId") REFERENCES public.feedbacks("Id") ON DELETE CASCADE;

-- Respostas pertencem a Perguntas (exclusão restrita)
ALTER TABLE ONLY public.feedback_respostas
    ADD CONSTRAINT "feedback_respostas_PerguntaId_fkey" FOREIGN KEY ("PerguntaId") REFERENCES public.perguntas("Id") ON DELETE RESTRICT;

-- Feedbacks pertencem a Categorias (exclusão restrita)
ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT "feedbacks_CategoriaId_fkey" FOREIGN KEY ("CategoriaId") REFERENCES public.categorias("Id") ON DELETE RESTRICT;

-- Alert rules pertencem a Categorias (exclusão restrita)
ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT fk_alert_rules_categoria FOREIGN KEY ("CategoriaId") REFERENCES public.categorias("Id") ON DELETE RESTRICT;

-- password reset tokens pertencem a Administradores (exclusão em cascata)
ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT "password_reset_tokens_AdministradorId_fkey" FOREIGN KEY ("AdministradorId") REFERENCES public.administradores("Id") ON DELETE CASCADE;

-- Pergunta opções pertencem a Perguntas (exclusão em cascata)
ALTER TABLE ONLY public.pergunta_opcoes
    ADD CONSTRAINT "pergunta_opcoes_PerguntaId_fkey" FOREIGN KEY ("PerguntaId") REFERENCES public.perguntas("Id") ON DELETE CASCADE;

-- Perguntas pertencem a Categorias (exclusão em cascata)
ALTER TABLE ONLY public.perguntas
    ADD CONSTRAINT "perguntas_CategoriaId_fkey" FOREIGN KEY ("CategoriaId") REFERENCES public.categorias("Id") ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 8hY1O6hFuHNVxGU9i5cllkHrTv9D1TytbxP9tmx1EEKPPUyYXStVgssVBWuBA10

