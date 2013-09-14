package main

import (
	"compress/gzip"
	"html/template"
	"io"
	"net/http"
	"strings"
)

const (
	port = ":8080"
)

type Page struct {
	Title string
	SourceCommentHeader template.HTML
}

type gzipResponseWriter struct {
	io.Writer
	http.ResponseWriter
}
 
func (w gzipResponseWriter) Write(b []byte) (int, error) {
	if "" == w.Header().Get("Content-Type") {
        // If no content type, apply sniffing algorithm to un-gzipped body.
        w.Header().Set("Content-Type", http.DetectContentType(b))
    }
	return w.Writer.Write(b)
}
 
func makeGzipHandler(fn http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			fn(w, r)
			return
		}
		w.Header().Set("Content-Encoding", "gzip")
		gz := gzip.NewWriter(w)
		defer gz.Close()
		gzr := gzipResponseWriter{Writer: gz, ResponseWriter: w}
		fn(gzr, r)
	}
}

func serveSingle(pattern string, filename string) {
	http.HandleFunc(pattern, makeGzipHandler(func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, filename)
	}))
}

func IndexHandler(w http.ResponseWriter, r *http.Request) {
	page := new(Page)
	page.Title = "BoardGameGeek Price Index"
	page.SourceCommentHeader = template.HTML("<!-- https://github.com/zaknelson/bgg-prices/ -->")

	t := template.New("index")
	t, _ = t.ParseFiles("templates/index.html")
	t.ExecuteTemplate(w, "index.html", page)
}

func init() {
	http.HandleFunc("/", makeGzipHandler(IndexHandler))
	serveSingle("/api/v1/games", "model/games.json")
	http.Handle("/css/", http.StripPrefix("/css/", http.FileServer(http.Dir("./css/"))))
	http.Handle("/js/", http.StripPrefix("/js/", http.FileServer(http.Dir("./js/"))))
	http.Handle("/fonts/", http.StripPrefix("/fonts/", http.FileServer(http.Dir("./fonts/"))))
	http.Handle("/images/", http.StripPrefix("/images/", http.FileServer(http.Dir("./images/"))))
	http.ListenAndServe(port, nil)
}

func main() {}