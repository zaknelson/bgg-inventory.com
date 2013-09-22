package main

import (
	"compress/gzip"
	"fmt"
	"html/template"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"
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
	page.Title = "BoardGameGeek Inventory"
	page.SourceCommentHeader = template.HTML("<!-- https://github.com/zaknelson/bgg-prices/ -->")

	t := template.New("index")
	t, _ = t.ParseFiles("templates/index.html")
	t.ExecuteTemplate(w, "index.html", page)
}

func UpdateHandler(w http.ResponseWriter, r *http.Request) {
	startedInfo, lastStartedErr := os.Stat("model/started.txt")
	startedTimeAgo := time.Now().Sub(startedInfo.ModTime())

	finishedInfo, finishedErr := os.Stat("model/games.json")
	finishedTimeAgo := time.Now().Sub(finishedInfo.ModTime())

	if  lastStartedErr == nil && finishedErr == nil && 
		startedTimeAgo.Minutes() > 20 && finishedTimeAgo.Hours() > 24 {
		go func() {
			ioutil.WriteFile("model/started.txt", nil, 0644)
			command := exec.Command("ruby", "bgg-inventory-scraper.rb")
			err := command.Run()
			if err != nil {
				fmt.Printf("Error occurred with first fetch attempt, try again")
				time.Sleep(5 * time.Second)
				command := exec.Command("ruby", "bgg-inventory-scraper.rb")
				command.Run()
				// If we fail again, oh well will just have to try again later
			}
		}()
	}

	fmt.Fprintf(w, "%s", finishedInfo.ModTime().Format(time.ANSIC))
}

func init() {
	http.HandleFunc("/", makeGzipHandler(IndexHandler))
	http.HandleFunc("/update", UpdateHandler)
	serveSingle("/api/v1/games", "model/games.json")
	http.Handle("/css/", http.StripPrefix("/css/", http.FileServer(http.Dir("./css/"))))
	http.Handle("/js/", http.StripPrefix("/js/", http.FileServer(http.Dir("./js/"))))
	http.Handle("/fonts/", http.StripPrefix("/fonts/", http.FileServer(http.Dir("./fonts/"))))
	http.Handle("/images/", http.StripPrefix("/images/", http.FileServer(http.Dir("./images/"))))
	http.ListenAndServe(":" + os.Getenv("PORT"), nil)
}

func main() {}